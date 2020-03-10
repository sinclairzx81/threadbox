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

export { channel, select, Sender, Receiver, EOF }            from './channel/index'
export { into }                                              from './async/index'

import { ThreadLocal, ThreadRegistry, ThreadHandle, Spawn }  from './thread/index'
import { MarshalEncoder }                                    from './marshal/index'

// #region Marshal

export type MarshalConstructor<T> = new (...args: any[]) => T

/** 
 * Registers this class as marshalled. This will enable instances 
 * of this class to be marshalled and re-constructed when passing 
 * between threads boundaries.
 */
export function __Marshal<T>(constructor: MarshalConstructor<T>) {

    MarshalEncoder.register(constructor)
}

/** 
 * [decorator] Registers this class as marshalled. This will enable instances 
 * of this class to be marshalled and re-constructed when passing 
 * between threads boundaries. Alias for `__Marshal(constructor)`
 */
export function Marshal() {

    return (constructor: MarshalConstructor<any>) => __Marshal(constructor)
}

// #endregion

// #region Thread

export type AnyFunction =  (...args: any[]) => any

export type ThreadConstructor<T>   = new (...args: any[]) => T

export type ThreadFunction<F extends AnyFunction> =
    F extends () => infer U ? () => Promise<ThreadResult<U>> :
    F extends (p0: infer T0) => infer U ? (p0: T0) => Promise<ThreadResult<U>> :
    F extends (p0: infer T0, p1: infer T1) => infer U ? (p0: T0, p1: T1) => Promise<ThreadResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2) => infer U ? (p0: T0, p1: T1, p2: T2) => Promise<ThreadResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3) => Promise<ThreadResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4) => Promise<ThreadResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4, p5: infer T5) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4, p5: T5) => Promise<ThreadResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4, p5: infer T5, p6: infer T6) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6) => Promise<ThreadResult<U>> :
    F extends (p0: infer T0, p1: infer T1, p2: infer T2, p3: infer T3, p4: infer T4, p5: infer T5, p6: infer T6, p7: infer T7) => infer U ? (p0: T0, p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6, p7: T7) => Promise<ThreadResult<U>> :
    F extends (...args: any[]) => infer U ? (...args: any[]) => Promise<ThreadResult<U>> :
    F;

export type ThreadResult<T> = T extends Promise<infer U> ? U : T

export type ThreadInterface<T> = { 
    [K in keyof T]: T[K] extends AnyFunction ? ThreadFunction<T[K]> : never 
} & {
    dispose(): Promise<void> | void
}

/**
 * Registers a constructor as threadable. This allows this constructor to be 
 * to be instanced within a remote threads via `spawn()`
 */
export function __Thread<T>(constructor: ThreadConstructor<T>) {

    ThreadRegistry.registerWorkerConstructor(constructor)
}

/**
 * [decorator] Registers a constructor as threadable. This allows this constructor to be 
 * to be instanced within a remote threads via `spawn()`. Alias for `__Thread(constructor)`.
 */
export function Thread<T = any>() {

    return (constructor: ThreadConstructor<any>) => __Thread(constructor)
}

// #endregion

// #region Main


export type MainConstructor = new (...args: any[]) => MainInterface

export type MainInterface = {

    main(args: string[]): Promise<number | void> | number | void
}


/**
 * Registers a constructor as an application entry point. This constructor
 * will be called when the program starts.
 */
export function __Main(constructor: MainConstructor) {

    ThreadRegistry.registerMainConstructor(constructor)
}

/**
 * [decorator] Registers a constructor as an application entry point. This constructor
 * will be called when the program starts. Alias for `__Main(constructor)`.
 */
export function Main() {

    return (constructor: MainConstructor) => __Main(constructor)
}

// #endregion

// #region Spawn

/**
 * Spawns the a new thread with the given constructor. The additional parameters given will be
 * injected into the constructor when instanced in the remote thread. The constructor given must
 * be registered threadable or a `ConstructorNotThreadableError` error will be thrown.
 */
export function spawn<T>(constructor: ThreadConstructor<T>, ...params: any[]): ThreadInterface<T> {

    return Spawn.spawn(constructor, ...params) as ThreadHandle & ThreadInterface<T>
}


// #endregion

ThreadLocal.start() // Go!
