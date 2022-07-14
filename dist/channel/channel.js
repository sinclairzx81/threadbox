"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.channel = exports.Receiver = exports.Sender = exports.EOF = exports.ReceiverAcknowledgementError = exports.ReceiverProtocolViolationError = exports.SenderProtocolViolationError = void 0;
const worker_threads_1 = require("worker_threads");
const index_1 = require("../marshal/index");
const protocol_1 = require("./protocol");
const queue_1 = require("./queue");
// #region Errors
/** Raised if a `Sender` sends an invalid protocol message. */
class SenderProtocolViolationError extends Error {
    constructor() {
        super('Receiver received an unexpected protocol message from the Sender.');
    }
}
exports.SenderProtocolViolationError = SenderProtocolViolationError;
/** Raised if a `Receiver` sends an invalid protocol message. */
class ReceiverProtocolViolationError extends Error {
    constructor() {
        super('Sender received an unexpected protocol message from the Receiver.');
    }
}
exports.ReceiverProtocolViolationError = ReceiverProtocolViolationError;
/** Raised if a `Receiver` acknowledges an unknown ordinal. */
class ReceiverAcknowledgementError extends Error {
    constructor() {
        super('Sender recieved an unexpected ordinal acknowledgement from the Receiver');
    }
}
exports.ReceiverAcknowledgementError = ReceiverAcknowledgementError;
// #endregion
exports.EOF = Symbol('EOF');
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
class Sender {
    constructor(port) {
        this.port = port;
        this.awaiters = new Map();
        this.ordinal = 0;
        this.subscribed = false;
    }
    /** Sends a value to this channel. */
    send(value) {
        this.subscribeToPort();
        return new Promise(resolve => {
            const kind = 'value';
            const ordinal = this.setAwaiter(resolve);
            const [message, transferList] = (0, protocol_1.encode)({ kind, ordinal, value });
            this.port.postMessage(message, transferList);
        });
    }
    /** Sends a shutdown signal to this channel. */
    end() {
        this.subscribeToPort();
        return new Promise(resolve => {
            const kind = 'shutdown';
            const ordinal = this.setAwaiter(resolve);
            const [message, transferList] = (0, protocol_1.encode)({ kind, ordinal });
            this.port.postMessage(message, transferList);
        });
    }
    /** Sets a sender awaiter. Returns the ordinal for subscription. */
    setAwaiter(resolve) {
        const ordinal = ++this.ordinal;
        this.awaiters.set(ordinal, resolve);
        return ordinal;
    }
    /** Gets a sender awaiter. Returns the resolver for this ordinal. */
    getAwaiter(ordinal) {
        if (!this.awaiters.has(ordinal)) {
            throw new ReceiverAcknowledgementError();
        }
        const awaiter = this.awaiters.get(ordinal);
        this.awaiters.delete(ordinal);
        return awaiter;
    }
    /**
     * Subscribes to this receivers port. Note: This function is called
     * on each call to `send()` | `end()`. It is required as marshalling
     * port subscription logic is not possible. This function ensures that
     * subscription happens within the owner thread.
     */
    subscribeToPort() {
        if (!this.subscribed) {
            this.port.on('message', ack => this.onMessage((0, protocol_1.decode)(ack)));
            this.subscribed = true;
        }
    }
    onMessage(message) {
        const awaiter = this.getAwaiter(message.ordinal);
        switch (message.kind) {
            case 'value': {
                awaiter(void 0);
                break;
            }
            case 'shutdown': {
                awaiter(void 0);
                this.port.close();
                break;
            }
            default: {
                throw new ReceiverProtocolViolationError();
            }
        }
    }
}
exports.Sender = Sender;
index_1.MarshalRegistry.registerConstructor(Sender);
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
class Receiver {
    constructor(port) {
        this.port = port;
        this.subscribed = false;
        this.queue = new queue_1.Queue();
    }
    /** Receives one message or EOF if end. */
    async receive() {
        this.subscribeToPort();
        const send = await this.queue.dequeue();
        switch (send.kind) {
            case 'value': {
                const kind = 'value';
                const ordinal = send.ordinal;
                const [message, transferList] = (0, protocol_1.encode)({ kind, ordinal });
                this.port.postMessage(message, transferList);
                return send.value;
            }
            case 'shutdown': {
                const kind = 'shutdown';
                const ordinal = send.ordinal;
                const [message, transferList] = (0, protocol_1.encode)({ kind, ordinal });
                this.port.postMessage(message, transferList);
                return exports.EOF;
            }
            default: {
                throw new SenderProtocolViolationError();
            }
        }
    }
    /**
     * Subscribes to this receivers port. Note: This function is called
     * on each call to `receive()`. It is required as marshalling port
     * subscription logic is not possible. This function ensures that
     * subscription happens within the owner thread.
     */
    subscribeToPort() {
        if (!this.subscribed) {
            this.port.on('message', send => { this.queue.enqueue((0, protocol_1.decode)(send)); });
            this.subscribed = true;
        }
    }
    /** (async-iterator) The iterator for this receiver. */
    async *[Symbol.asyncIterator]() {
        while (true) {
            const next = await this.receive();
            if (next === exports.EOF) {
                break;
            }
            yield next;
        }
    }
}
exports.Receiver = Receiver;
// Register Sender and Receiver as Marshalled.
index_1.MarshalRegistry.registerConstructor(Receiver);
/**
 * Creates an asynchronous messaging channel for the given type `T`.
 *
 * ```typescript
 * // Example
 * const [sender, receiver] = channel()
 * ```
 */
function channel() {
    const channel = new worker_threads_1.MessageChannel();
    const sender = new Sender(channel.port1);
    const receiver = new Receiver(channel.port2);
    return [sender, receiver];
}
exports.channel = channel;
