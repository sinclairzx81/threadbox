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

import { isMainThread, workerData, MessagePort, parentPort } from 'worker_threads'
import { ThreadProtocol, ConstructMessage, Construct, Execute, Dispose, Terminate } from './protocol'
import { ThreadRegistry } from './registry'

/**
 * The WorkerData exchanged on worker startup.
 */
export type WorkerData = {
    construct: ConstructMessage
}

/**
 * Encapsulates the logic for starting the local thread. Manages
 * interactions between the local thread and its parent. Is also
 * responsible for starting the `Main` thread.
 */
export class ThreadLocal {
    /** Executes a function on the instance. */
    private static async execute(port: MessagePort, instance: any, command: Execute) {
        const func = await instance[command.functionKey] as Function
        if (typeof func !== 'function') {
            const ordinal = command.ordinal
            const error = `The function '${command.functionKey}' does not exist`
            const [message, transferList] = ThreadProtocol.encode({ kind: 'error', ordinal, error })
            port.postMessage(message, transferList)
            return
        }
        try {
            const ordinal = command.ordinal
            const result = await func.apply(instance, command.params)
            const [message, transferList] = ThreadProtocol.encode({ kind: 'result', ordinal, result })
            port.postMessage(message, transferList)
        } catch (error) {
            const ordinal = command.ordinal
            const [message, transferList] = ThreadProtocol.encode({ kind: 'error', ordinal, error })
            port.postMessage(message, transferList)
        }
    }

    /** Attempts to call dispose on the instance. If not exists, just respond 'disposed' */
    private static async dispose(port: MessagePort, instance: any, command: Dispose) {
        const func = await instance['dispose'] as Function
        if (func) {
            await func.apply(instance, [])
        }
        const ordinal = command.ordinal
        const [message, transferList] = ThreadProtocol.encode({ kind: 'disposed', ordinal })
        port.postMessage(message, transferList)
    }

    /** Terminates this process. */
    private static terminate(_port: MessagePort, _instance: any, _command: Terminate) {
        setImmediate(() => process.exit(0))
    }

    /** Starts listening on given port for protocol messages. */
    private static listen(instance: any, port: MessagePort) {
        port.on('message', async message => {
            const command = ThreadProtocol.decode(message)
            switch (command.kind) {
                case 'execute':   return this.execute(port, instance, command)
                case 'dispose':   return this.dispose(port, instance, command)
                case 'terminate': return this.terminate(port, instance, command)
            }
        })
    }

    /** Starts the local thread. Will spin up either the Main or Worker classes based on the construct ThreadKey. */
    public static start() {
        setImmediate(async () => {
            // Activate main
            if(isMainThread) {
                const constructor = ThreadRegistry.getMainConstructor()
                if (constructor) {
                    const instance = new constructor()
                    await instance.main(process.argv)
                }
            } 
            // Activate worker
            else if (workerData && parentPort && workerData.construct) {
                const construct = ThreadProtocol.decode(workerData.construct) as Construct
                const constructor = ThreadRegistry.getConstructorFromThreadKey(construct.threadKey)
                if (constructor) {
                    const instance = new constructor(...construct.params)
                    this.listen(instance, parentPort!)
                }
            } else {
                // Cannot activate. Ignore.
            }
        })
    }
}
