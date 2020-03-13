/*--------------------------------------------------------------------------

ThreadBox - Recursive Worker Threads in NodeJS

The MIT License (MIT)

Copyright (c) 2020 Haydn Paterson (sinclair) <haydn.developer@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

---------------------------------------------------------------------------*/

import { MessageChannel, MessagePort } from 'worker_threads'
import { MarshalRegistry }             from '../marshal/index'
import { encode, decode }              from './protocol'
import { Queue }                       from './queue'

type Resolve<T> = (value: T) => void

// #region Errors

/** Raised if a `Sender` sends an invalid protocol message. */
export class SenderProtocolViolationError extends Error {
    constructor() {
        super('Receiver received an unexpected protocol message from the Sender.')
    }
}
/** Raised if a `Receiver` sends an invalid protocol message. */
export class ReceiverProtocolViolationError extends Error {
    constructor() {
        super('Sender received an unexpected protocol message from the Receiver.')
    }
}

/** Raised if a `Receiver` acknowledges an unknown ordinal. */
export class ReceiverAcknowledgementError extends Error {
    constructor() {
        super('Sender recieved an unexpected ordinal acknowledgement from the Receiver')
    }
}

// #endregion

// #region Protocol

type SendValue<T>        = { kind: 'value', ordinal: Ordinal, value: T }
type SendShutdown        = { kind: 'shutdown', ordinal: Ordinal, }
type Send<T>             = SendValue<T> | SendShutdown
type AcknowledgeValue    = { kind: 'value', ordinal: Ordinal, }
type AcknowledgeShutdown = { kind: 'shutdown', ordinal: Ordinal, }
type Acknowledge         = AcknowledgeValue | AcknowledgeShutdown
type Ordinal             = number

// #endregion

export const EOF = Symbol('EOF')

/** 
 * Sends values into a channel. Allows senders to 
 * optionally await for the reciever to receive each 
 * value. Senders are `Marshal`.
 * 
 * ```typescript
 * // Synchronized
 * await sender.send(1)
 * await sender.send(2)
 * await sender.send(3)
 * await sender.end()
 * 
 * // Async-Buffered
 * sender.send(1)
 * sender.send(2)
 * sender.send(3)
 * await sender.end()
 * ```
 */
export class Sender<T = any> {
    private awaiters = new Map<number, Resolve<void>>()
    private ordinal:    Ordinal = 0
    private subscribed: boolean = false
    constructor(private readonly port: MessagePort) {
    }

    /** Sends a value to this channel. */
    public send(value: T): Promise<void> {
        this.subscribeToPort()
        return new Promise<void>(resolve => {
            const kind = 'value'
            const ordinal = this.setAwaiter(resolve)
            const [message, transferList] = encode<SendValue<T>>({ kind, ordinal, value })
            this.port.postMessage(message, transferList)
        })
    }

    /** Sends a shutdown signal to this channel. */
    public end(): Promise<void> {
        this.subscribeToPort()
        return new Promise<void>(resolve => {
            const kind = 'shutdown'
            const ordinal = this.setAwaiter(resolve)
            const [message, transferList] = encode<SendShutdown>({ kind, ordinal })
            this.port.postMessage(message, transferList)
        })
    }

    /** Sets a sender awaiter. Returns the ordinal for subscription. */
    private setAwaiter(resolve: Resolve<void>): Ordinal {
        const ordinal = ++this.ordinal
        this.awaiters.set(ordinal, resolve)
        return ordinal
    }

    /** Gets a sender awaiter. Returns the resolver for this ordinal. */
    private getAwaiter(ordinal: Ordinal): Resolve<void> {
        if (!this.awaiters.has(ordinal)) {
            throw new ReceiverAcknowledgementError()
        }
        const awaiter = this.awaiters.get(ordinal)!
        this.awaiters.delete(ordinal)
        return awaiter
    }

    /** 
     * Subscribes to this receivers port. Note: This function is called
     * on each call to `send()` | `end()`. It is required as marshalling
     * port subscription logic is not possible. This function ensures that
     * subscription happens within the owner thread.
     */
    private subscribeToPort() {
        if(!this.subscribed) {
            this.port.on('message', ack => this.onMessage(decode(ack)))
            this.subscribed = true
        }
    }
    private onMessage(message: Acknowledge) {
        const awaiter = this.getAwaiter(message.ordinal)
        switch (message.kind) {
            case 'value': {
                awaiter(void 0)
                break
            }
            case 'shutdown': {
                awaiter(void 0)
                this.port.close()
                break
            }
            default: {
                throw new ReceiverProtocolViolationError()
            }
        }
    }
}

MarshalRegistry.registerConstructor(Sender)

/**
 * Receives values from a channel. Allows the receiver
 * to receive values one by one, or through async
 * iteration. Receivers are `Marshal`.
 * 
 * ```typescript
 * // Receive
 * const next = await receiver.receive()
 * if(next !== EOF) { ... } else { ... }
 * 
 * // Iteration
 * for await(const value of reciever) { ... }
 * ```
 */
export class Receiver<T = any> {
    private readonly queue: Queue<Send<T>>
    private subscribed: boolean = false
    constructor(private readonly port: MessagePort) {
        this.queue = new Queue<Send<T>>()
    }

    /** Receives one message or EOF if end. */
    public async receive(): Promise<T | typeof EOF> {
        this.subscribeToPort()
        const send = await this.queue.dequeue()
        switch (send.kind) {
            case 'value': {
                const kind = 'value'
                const ordinal = send.ordinal
                const [message, transferList] = encode<AcknowledgeValue>({ kind, ordinal })
                this.port.postMessage(message, transferList)
                return send.value
            }
            case 'shutdown': {
                const kind = 'shutdown'
                const ordinal = send.ordinal
                const [message, transferList] = encode<AcknowledgeShutdown>({ kind, ordinal })
                this.port.postMessage(message, transferList)
                return EOF
            }
            default: {
                throw new SenderProtocolViolationError()
            }
        }
    }

    /** 
     * Subscribes to this receivers port. Note: This function is called
     * on each call to `receive()`. It is required as marshalling port
     * subscription logic is not possible. This function ensures that
     * subscription happens within the owner thread.
     */
    private subscribeToPort() {
        if(!this.subscribed) {
            this.port.on('message', send => { this.queue.enqueue(decode(send)) })
            this.subscribed = true
        }
    }

    /** (async-iterator) The iterator for this receiver. */
    public async *[Symbol.asyncIterator](): AsyncGenerator<T | typeof EOF> {
        while (true) {
            const next = await this.receive()
            if (next === EOF) {
                break
            }
            yield next
        }
    }
}

// Register Sender and Receiver as Marshalled.
MarshalRegistry.registerConstructor(Receiver)

/** 
 * Creates an asynchronous messaging channel for the given type `T`. 
 * 
 * ```typescript
 * // Example
 * const [sender, receiver] = channel()
 * ```
 */
export function channel<T = any>(): [Sender<T>, Receiver<T>] {
    const channel  = new MessageChannel()
    const sender   = new Sender<T>(channel.port1)
    const receiver = new Receiver<T>(channel.port2)
    return [sender, receiver]
}