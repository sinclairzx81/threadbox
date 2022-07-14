"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadHandle = exports.ThreadEntry = exports.ThreadInvalidCommandError = exports.ConstructorNotThreadableError = void 0;
const worker_threads_1 = require("worker_threads");
const protocol_1 = require("./protocol");
const registry_1 = require("./registry");
const path_1 = require("path");
// #region Errors
/** Raised if a constructor is not threadable. */
class ConstructorNotThreadableError extends Error {
    constructor(constructor) {
        super(`The class '${constructor.name}' has not been registered as a thread.`);
    }
}
exports.ConstructorNotThreadableError = ConstructorNotThreadableError;
/** Raised on protocol violation. */
class ThreadInvalidCommandError extends Error {
    constructor(command) {
        const data = JSON.stringify(command);
        super(`Received an invalid command from the worker thread ${data}`);
    }
}
exports.ThreadInvalidCommandError = ThreadInvalidCommandError;
// #endregion
// #region ThreadEntry
class ThreadEntry {
    /** Resolves this applications entry module. */
    static resolve() {
        return (0, path_1.extname)(process.argv[1]) !== '.js' ? process.argv[1] + '.js' : process.argv[1];
    }
}
exports.ThreadEntry = ThreadEntry;
/**
 * A handle to a spawned thread. Encapulates protocol message
 * exchange to the remote thread and allows functions to be
 * executed on the remote instanced class via `FunctionKey`.
 * Also includes the logic to `terminate` the remote worker.
 */
class ThreadHandle {
    /** Creates a new thread with the given constructor and arguments. */
    constructor(resourceLimits, constructor, args) {
        this.awaiters = new Map();
        this.ordinal = 0;
        const threadKey = registry_1.ThreadRegistry.getThreadKeyFromConstructor(constructor);
        if (threadKey === null) {
            throw new ConstructorNotThreadableError(constructor);
        }
        const [construct, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'construct', ordinal: 0, threadKey, args });
        const workerData = { construct };
        // transferList -> https://github.com/nodejs/node/pull/32278
        const workerOptions = { workerData, resourceLimits, transferList };
        this.worker = new worker_threads_1.Worker(ThreadEntry.resolve(), workerOptions);
        this.worker.on('message', message => this.onMessage(message));
    }
    /** Executes a function on the thread with the given 'functionKey' and parameters. */
    execute(functionKey, args) {
        return new Promise((resolve, reject) => {
            const ordinal = this.setAwaiter([resolve, reject]);
            const [message, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'execute', ordinal, functionKey, args });
            this.worker.postMessage(message, transferList);
        });
    }
    /** Disposes this thread and terminates. Returns a Promise that resolves once the thread has terminated. */
    dispose() {
        return new Promise((resolve, reject) => {
            const ordinal = this.setAwaiter([resolve, reject]);
            const [message, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'dispose', ordinal });
            this.worker.postMessage(message, transferList);
        });
    }
    /** Protocol: Result Handler. */
    onResult(command) {
        const [resolve, _] = this.getAwaiter(command.ordinal);
        resolve(command.result);
    }
    /** Protocol: Error Handler. */
    onError(command) {
        const [_, reject] = this.getAwaiter(command.ordinal);
        reject(command.error);
    }
    /** Protocol: Disposed Handler. */
    onDisposed(command) {
        const [resolve, _] = this.getAwaiter(command.ordinal);
        const [message, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'terminate' });
        this.worker.postMessage(message, transferList);
        resolve(null);
    }
    /** Handles protocol messages. */
    onMessage(message) {
        const command = protocol_1.ThreadProtocol.decode(message);
        switch (command.kind) {
            case 'result': return this.onResult(command);
            case 'error': return this.onError(command);
            case 'disposed': return this.onDisposed(command);
            default: throw new ThreadInvalidCommandError(command);
        }
    }
    /** Sets an awaiter and returns its `Ordinal` */
    setAwaiter(awaiter) {
        const ordinal = ++this.ordinal;
        this.awaiters.set(ordinal, awaiter);
        return ordinal;
    }
    /** Gets an awaiter from the given `Ordinal`. */
    getAwaiter(ordinal) {
        if (!this.awaiters.has(ordinal)) {
            throw Error('cannot get awaiter');
        }
        const awaiter = this.awaiters.get(ordinal);
        this.awaiters.delete(ordinal);
        return awaiter;
    }
    /**
     * Creates a ThreadHandle with the given constructor and arguments. Returns
     * proxy handle to the remote worker thread class instance.
     */
    static create(resourceLimits, constructor, ...args) {
        return new Proxy(new ThreadHandle(resourceLimits, constructor, args), {
            get: (target, functionKey) => (...params) => {
                return (functionKey !== 'dispose')
                    ? target.execute(functionKey, params)
                    : target.dispose();
            }
        });
    }
}
exports.ThreadHandle = ThreadHandle;
