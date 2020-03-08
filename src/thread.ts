/*--------------------------------------------------------------------------

ThreadBox - Recursive multi threaded worker processes in NodeJS

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

import { Worker }            from 'worker_threads'
import { Protocol }          from './static/protocol'
import { Message }           from './static/protocol'
import { ResultCommand }     from './static/protocol'
import { ErrorCommand }      from './static/protocol'
import { DisposedCommand }   from './static/protocol'
import { lookup_thread_key } from './static/threads'
import { extname }           from 'path'

const filename = extname(process.argv[1]) !== '.js' ? process.argv[1] + '.js' : process.argv[1]

export class ConstructorNotThreadableError extends Error {

    constructor(constructor: new (...args: any[]) => any) {

        super(`The class '${constructor.name}' has not been registered as a thread.`)
    }
}

interface Awaiter {

    resolve: (value: any) => void
    
    reject: (error: Error) => void
}

/** A worker thread container that manages raw interaction with the worker. */
export class Thread {

    private awaiters = new Map<number, Awaiter>()

    private worker: Worker

    /** Creates a new thread with the given constructor and parameters. */
    constructor(constructor: new (...args: any[]) => any, params: any[]) {

        const key = lookup_thread_key(constructor)

        if (key === undefined) {

            throw new ConstructorNotThreadableError(constructor)
        }

        this.worker = new Worker(filename, {

            workerData: {

                construct: Protocol.encode({

                    kind: 'construct',

                    id: -1,

                    key,

                    params,
                })
            }
        })

        this.worker.on('message', message => this.on_receive(message))
    }

    /** Executes a function on the thread with the given 'key' and parameters. */
    public execute(key: string, params: any[]): Promise<any> {

        return new Promise<any>((resolve, reject) => {

            const id = this.set_awaiter({ resolve, reject })

            const message = Protocol.encode({ kind: 'execute', id, key, params })

            this.worker.postMessage(message, [])
        })
    }

    /** Diposes and terminates this thread. */
    public dispose(): Promise<void> {

        return new Promise<any>((resolve, reject) => {

            const id = this.set_awaiter({ resolve, reject })

            this.worker.postMessage(Protocol.encode({ kind: 'dispose', id }))
        })
    }

    /** Handles incoming results. */
    private on_result(command: ResultCommand) {

        const awaiter = this.get_awaiter(command.id)

        awaiter.resolve(command.result)
    }

    /** Handles incoming errors. */
    private on_error(command: ErrorCommand) {

        const awaiter = this.get_awaiter(command.id)

        awaiter.reject(command.error)
    }

    /** Handles incoming disposed. */
    private on_disposed(command: DisposedCommand) {

        const awaiter = this.get_awaiter(command.id)

        this.worker.postMessage(Protocol.encode({ kind: 'terminate' }))

        awaiter.resolve(null)
    }

    /** Handles protocol messages. */
    private on_receive(message: Message) {

        const command = Protocol.decode(message)

        switch (command.kind) {

            case 'result': return this.on_result(command)

            case 'error': return this.on_error(command)

            case 'disposed': return this.on_disposed(command)

            default: throw Error(`Unexpected message '${command.kind}'`)
        }
    }


    private awaiter_id: number = 0

    private get_awaiter(id: number): { resolve: Function, reject: Function } {

        if (!this.awaiters.has(id)) {

            throw Error('cannot get awaiter')
        }

        const awaiter = this.awaiters.get(id)!

        this.awaiters.delete(id)

        return awaiter
    }

    private set_awaiter(awaiter: Awaiter) {

        const next = this.awaiter_id++

        this.awaiters.set(next, awaiter)

        return next
    }
}
