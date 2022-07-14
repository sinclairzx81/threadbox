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
exports.ThreadLocal = exports.HostInvalidCommandError = void 0;
const worker_threads_1 = require("worker_threads");
const protocol_1 = require("./protocol");
const registry_1 = require("./registry");
// #region Errors
class HostInvalidCommandError extends Error {
    constructor(command) {
        const json = JSON.stringify(command);
        super(`Received an invalid command from the host thread ${json}`);
    }
}
exports.HostInvalidCommandError = HostInvalidCommandError;
/**
 * Encapsulates the logic for starting the local thread. Manages
 * interactions between the local thread and its parent. Is also
 * responsible for starting the `Main` thread.
 */
class ThreadLocal {
    /** Executes a function on the instance. */
    static async execute(port, instance, command) {
        const func = await instance[command.functionKey];
        if (typeof func !== 'function') {
            const ordinal = command.ordinal;
            const error = `The function '${command.functionKey}' does not exist`;
            const [message, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'error', ordinal, error });
            port.postMessage(message, transferList);
            return;
        }
        try {
            const ordinal = command.ordinal;
            const result = await func.apply(instance, command.args);
            const [message, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'result', ordinal, result });
            port.postMessage(message, transferList);
        }
        catch (error) {
            const ordinal = command.ordinal;
            const [message, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'error', ordinal, error });
            port.postMessage(message, transferList);
        }
    }
    /** Attempts to call dispose on the instance. If not exists, just respond 'disposed' */
    static async dispose(port, instance, command) {
        const func = await instance['dispose'];
        if (func) {
            await func.apply(instance, []);
        }
        const ordinal = command.ordinal;
        const [message, transferList] = protocol_1.ThreadProtocol.encode({ kind: 'disposed', ordinal });
        port.postMessage(message, transferList);
    }
    /** Terminates this process. */
    static terminate(_port, _instance, _command) {
        setImmediate(() => process.exit(0));
    }
    /** Starts listening on given port for protocol messages. */
    static listen(instance, port) {
        port.on('message', async (message) => {
            const command = protocol_1.ThreadProtocol.decode(message);
            switch (command.kind) {
                case 'execute': return this.execute(port, instance, command);
                case 'dispose': return this.dispose(port, instance, command);
                case 'terminate': return this.terminate(port, instance, command);
                default: throw new HostInvalidCommandError(command);
            }
        });
    }
    /** Starts the local thread. Will spin up either the Main or Worker classes based on the construct ThreadKey. */
    static start() {
        setImmediate(async () => {
            // Activate main
            if (worker_threads_1.isMainThread) {
                const constructor = registry_1.ThreadRegistry.getMainConstructor();
                if (constructor) {
                    const instance = new constructor();
                    await instance.main(process.argv);
                }
            }
            // Activate worker
            else if (worker_threads_1.workerData && worker_threads_1.parentPort && worker_threads_1.workerData.construct) {
                const construct = protocol_1.ThreadProtocol.decode(worker_threads_1.workerData.construct);
                const constructor = registry_1.ThreadRegistry.getConstructorFromThreadKey(construct.threadKey);
                if (constructor) {
                    const instance = new constructor(...construct.args);
                    this.listen(instance, worker_threads_1.parentPort);
                }
            }
            else {
                // Cannot activate. Ignore.
            }
        });
    }
}
exports.ThreadLocal = ThreadLocal;
// #endregion
