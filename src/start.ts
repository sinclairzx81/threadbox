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

import { isMainThread, workerData, parentPort } from 'worker_threads'
import { MessagePort }            from 'worker_threads'
import { get_thread_constructor } from './static/threads'
import { get_main_constructor }   from './static/threads'
import { Protocol }               from './static/protocol'
import { ConstructMessage }       from './static/protocol'
import { ConstructCommand }       from './static/protocol'
import { ExecuteCommand }         from './static/protocol'
import { DisposeCommand }         from './static/protocol'
import { TerminateCommand }       from './static/protocol'

export interface WorkerData {

    construct: ConstructMessage
}

/** Starts up the worker thread class and dispatches calls on the instance. */
export class Start {

    /** Executes a function on the instance. */
    public static async execute(port: MessagePort, instance: any, command: ExecuteCommand) {

        const id = command.id
        
        const func = await instance[command.key] as Function
        
        if (typeof func !== 'function') {

            const error = `The function '${command.key}' does not exist`

            port.postMessage(Protocol.encode({ kind: 'error', id, error }))

            return
        }

        try {

            const result = await func.apply(instance, command.params)

            port.postMessage(Protocol.encode({ kind: 'result', id, result }))

        } catch (error) {

            port.postMessage(Protocol.encode({ kind: 'error', id, error }))
        }
    }

    /** Attempts to call dispose on the instance. If not exists, just respond 'disposed' */
    private static async dispose(port: MessagePort, instance: any, command: DisposeCommand) {

        const id = command.id
        
        const func = await instance['dispose'] as Function
        if (func) {

            await func.apply(instance, [])
        }

        port.postMessage(Protocol.encode({ kind: 'disposed', id }))
    }

    /** Terminates this process. */
    private static terminate(_port: MessagePort, _instance: any, _command: TerminateCommand) {

        setImmediate(() => process.exit(0))
    }

    /** Starts listening on given port for protocol messages. */
    public static listen(instance: any, port: MessagePort) {
        port.on('message', async message => {

            const command = Protocol.decode(message)

            switch (command.kind) {

                case 'execute': return this.execute(port, instance, command)

                case 'dispose': return this.dispose(port, instance, command)
                
                case 'terminate': return this.terminate(port, instance, command)
            }
        })
    }

    /** Starts the worker with the given worker data and message port. */
    public static run() {

        setImmediate(() => {

            if (!isMainThread && workerData && parentPort) {

                const construct = Protocol.decode(workerData.construct) as ConstructCommand

                const constructor = get_thread_constructor(construct.key)

                if (constructor) {

                    const instance = new constructor(...construct.params)

                    this.listen(instance, parentPort!)
                }

            } else {

                const constructor = get_main_constructor()

                if (constructor) {

                    const instance = new constructor()

                    instance.main(process.argv)
                }

            }
        })
    }
}
