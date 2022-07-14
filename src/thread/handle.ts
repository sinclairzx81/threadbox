/*--------------------------------------------------------------------------

ThreadBox - Recursive Multi-Threaded Worker Processes in NodeJS

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

import { Worker, WorkerOptions } from 'worker_threads'
import { ThreadProtocol, Message, CommandError, CommandResult, CommandDisposed, Command } from './protocol'
import { ThreadRegistry } from './registry'
import { extname } from 'path'

// #region Errors

/** Raised if a constructor is not threadable. */
export class ConstructorNotThreadableError extends Error {
    constructor(constructor: new (...args: any[]) => any) {
        super(`The class '${constructor.name}' has not been registered as a thread.`)
    }
}

/** Raised on protocol violation. */
export class ThreadInvalidCommandError extends Error {
    constructor(command: Command) {
        const data = JSON.stringify(command)
        super(`Received an invalid command from the worker thread ${data}`)
    }
}

// #endregion

// #region ThreadEntry

export class ThreadEntry {
    /** Resolves this applications entry module. */
    public static resolve(): string {
        return extname(process.argv[1]) !== '.js' ? process.argv[1] + '.js' : process.argv[1]
    }
}

// #endregion

type Resolve<T> = (value: T) => void
type Reject = (error: string) => void
type Deferred = [Resolve<any>, Reject]
type Constructor = new (...args: any[]) => any

type FunctionKey = string
type Ordinal = number

/** Worker thread resource limits */
export interface ThreadResourceLimits {
    /** The maximum size of the main heap in MB. */
    maxOldGenerationSizeMb?: number
    /** The maximum size of a heap space for recently created objects. */
    maxYoungGenerationSizeMb?: number 
    /** The size of a pre-allocated memory range used for generated code. */
    codeRangeSizeMb?: number 
}

/**
 * A handle to a spawned thread. Encapulates protocol message
 * exchange to the remote thread and allows functions to be
 * executed on the remote instanced class via `FunctionKey`.
 * Also includes the logic to `terminate` the remote worker.
 */
export class ThreadHandle {
    private readonly awaiters = new Map<number, Deferred>()
    private readonly worker: Worker
    private ordinal: Ordinal = 0

    /** Creates a new thread with the given constructor and arguments. */
    constructor(resourceLimits: ThreadResourceLimits, constructor: Constructor, args: any[]) {
        const threadKey = ThreadRegistry.getThreadKeyFromConstructor(constructor)
        if (threadKey === null) {
            throw new ConstructorNotThreadableError(constructor)
        }
        const [construct, transferList] = ThreadProtocol.encode({ kind: 'construct', ordinal: 0, threadKey, args })
        const workerData = { construct }
        // transferList -> https://github.com/nodejs/node/pull/32278
        const workerOptions = { workerData, resourceLimits, transferList } as WorkerOptions 
        this.worker = new Worker(ThreadEntry.resolve(), workerOptions)
        this.worker.on('message', message => this.onMessage(message))
    }

    /** Executes a function on the thread with the given 'functionKey' and parameters. */
    public execute(functionKey: FunctionKey, args: any[]): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const ordinal = this.setAwaiter([resolve, reject])
            const [message, transferList] = ThreadProtocol.encode({ kind: 'execute', ordinal, functionKey, args })
            this.worker.postMessage(message, transferList)
        })
    }

    /** Disposes this thread and terminates. Returns a Promise that resolves once the thread has terminated. */
    public dispose(): Promise<void> {
        return new Promise<any>((resolve, reject) => {
            const ordinal = this.setAwaiter([resolve, reject])
            const [message, transferList] = ThreadProtocol.encode({ kind: 'dispose', ordinal })
            this.worker.postMessage(message, transferList)
        })
    }

    /** Protocol: Result Handler. */
    private onResult(command: CommandResult) {
        const [resolve, _] = this.getAwaiter(command.ordinal)
        resolve(command.result)
    }

    /** Protocol: Error Handler. */
    private onError(command: CommandError) {
        const [_, reject] = this.getAwaiter(command.ordinal)
        reject(command.error)
    }

    /** Protocol: Disposed Handler. */
    private onDisposed(command: CommandDisposed) {
        const [resolve, _] = this.getAwaiter(command.ordinal)
        const [message, transferList] = ThreadProtocol.encode({ kind: 'terminate' })
        this.worker.postMessage(message, transferList)
        resolve(null)
    }
    /** Handles protocol messages. */
    private onMessage(message: Message) {
        const command = ThreadProtocol.decode(message)
        switch (command.kind) {
            case 'result': return this.onResult(command)
            case 'error': return this.onError(command)
            case 'disposed': return this.onDisposed(command)
            default: throw new ThreadInvalidCommandError(command)
        }
    }
    /** Sets an awaiter and returns its `Ordinal` */
    private setAwaiter(awaiter: Deferred): Ordinal {
        const ordinal = ++this.ordinal
        this.awaiters.set(ordinal, awaiter)
        return ordinal
    }
    /** Gets an awaiter from the given `Ordinal`. */
    private getAwaiter(ordinal: Ordinal): Deferred {
        if (!this.awaiters.has(ordinal)) {
            throw Error('cannot get awaiter')
        }
        const awaiter = this.awaiters.get(ordinal)!
        this.awaiters.delete(ordinal)
        return awaiter
    }
    /** 
     * Creates a ThreadHandle with the given constructor and arguments. Returns 
     * proxy handle to the remote worker thread class instance.
     */
    public static create(resourceLimits: ThreadResourceLimits, constructor: Constructor, ...args: any[]): ThreadHandle {
        return new Proxy(new ThreadHandle(resourceLimits, constructor, args), {
            get: (target: ThreadHandle, functionKey: string) => (...params: any[]) => {
                return (functionKey !== 'dispose')
                    ? target.execute(functionKey, params)
                    : target.dispose()
            }
        })
    }
}