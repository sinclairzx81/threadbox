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

import { register_marshal_constructor }         from './static/marshal'
import { register_thread_constructor }          from './static/threads'
import { register_main_constructor }            from './static/threads'
import { Thread }                               from './thread'
import { Start }                                from './start'

// #region Worker Interface Mapping

export interface Disposable {

    dispose(): Promise<void> | void
}
export type AnyFunction =  (...args: any[]) => any

export type WorkerResult<T> = T extends Promise<infer U> ? U : T

export type WorkerFunction<F extends AnyFunction> =
    F extends () => infer U ? () => Promise<WorkerResult<U>> :
    F extends (p0: infer T0) => infer U ? (p0: T0) => Promise<WorkerResult<U>> :
    F extends (p0: infer T0, p1: infer T1) => infer U ? (p0: T0, p1: T1) => Promise<WorkerResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2) => infer U ? (p0: T0, p1: T1, p2: T2) => Promise<WorkerResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3) => Promise<WorkerResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4) => Promise<WorkerResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4, p5: infer T5) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4, p5: T5) => Promise<WorkerResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4, p5: infer T5, p6: infer T6) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6) => Promise<WorkerResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4, p5: infer T5, p6: infer T6, p7: infer T7) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6, p7: T7) => Promise<WorkerResult<U>> :
    F extends (...args: any[]) => infer U ? (...args: any[]) => Promise<WorkerResult<U>> :
    F;

export type WorkerInterface<T> = { 

    [K in keyof T]: T[K] extends AnyFunction ? WorkerFunction<T[K]> : never 

} & Disposable

export type MainInterface = {

    main(args: string[]): Promise<number | void> | number | void
}

export type TransferConstructor<T> = new (...args: any[]) => T

export type WorkerConstructor<T>   = new (...args: any[]) => T

export type MainConstructor        = new (...args: any[]) => MainInterface

// #endregion

// #region Exports

/** 
 * Registers this class as mashalled. This enables instances of this
 * class to be copied and re-constructed when passed between threads,
 * where both instance data and prototype is reconstructed at the
 * receiver.
 */
export function __Transfer<T>(constructor: TransferConstructor<T>) {

    register_marshal_constructor(constructor)
}

/** 
 * [decorator]
 * 
 * Registers this class as transferable. This enables instances of this
 * class to be copied and re-constructed when passed between threads.
 */
export function Transfer() {

    return (constructor: TransferConstructor<any>) => __Transfer(constructor)
}

/**
 * Registers this constructor as a worker, allowing this constructor
 * to be spawned with the `spawn()` function.
 */
export function __Worker<T>(constructor: WorkerConstructor<T>) {

    register_thread_constructor(constructor)
}

/**
 * [decorator]
 * 
 * Registers this constructor as as a worker, allowing this constructor
 * to be spawned with the `spawn()` function.
 */
export function Worker<T = any>() {

    return (constructor: WorkerConstructor<any>) => __Worker(constructor)
}

/**
 * Registers this constructor as a worker, allowing this constructor
 * to be spawned with the `spawn()` function.
 */
export function __Main(constructor: MainConstructor) {

    register_main_constructor(constructor)
}

/**
 * [decorator]
 * 
 * Registers this constructor as as a worker, allowing this constructor
 * to be spawned with the `spawn()` function.
 */
export function Main() {

    return (constructor: MainConstructor) => __Main(constructor)
}



/**
 * Spawns the given constructor as a new worker thread. The parameters provided will be injected
 * into the constructor when instanced in the remote thread. The constructor provided must be 
 * registered as a thread or a `ConstructorNotThreadableError` error will be thrown.
 */
export function spawn<T>(constructor: WorkerConstructor<T>, ...params: any[]): WorkerInterface<T> {

    return new Proxy(new Thread(constructor, params), {

        get: (target: any, key: string) => (...params: any[]) => {

            return (key !== 'dispose')

                ? target.execute(key, params)

                : target.dispose()
        }
    })
}

Start.run()
