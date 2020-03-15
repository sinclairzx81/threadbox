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

import { ThreadLocal, ThreadRegistry, ThreadHandle, ThreadResourceLimits }  from './thread/index'
import { MarshalEncoder }                                                   from './marshal/index'

export { channel, select, Sender, Receiver, EOF }                           from './channel/index'
export { into }                                                             from './async/index'
export { Mutex, MutexLock }                                                 from './mutex/index'

// #region Marshal

/** 
 * Registers this class as marshalled. This will enable instances 
 * of this class to be sent and re-constructed when passed 
 * between threads boundaries.
 */
export function __Marshal<T extends any[], R>(constructor: new (...args: T) => R) {

    MarshalEncoder.register(constructor)
}

/** 
 * [decorator] Registers this class as marshalled. This will enable instances 
 * of this class to be sent and re-constructed when passed 
 * between threads boundaries. Alias for `__Marshal(constructor)`
 */
export function Marshal() {

    return <T extends any[], R>(constructor: new (...args: T) => R) => __Marshal(constructor)
}

// #endregion

// #region Thread

/**
 * Registers a constructor as threadable. This allows this constructor to be 
 * to be instanced within remote worker threads via `spawn()`
 */
export function __Thread(constructor: new (...args: any[]) => any) {

    ThreadRegistry.registerWorkerConstructor(constructor)
}

/**
 * [decorator] Registers a constructor as threadable. This allows this constructor to be 
 * to be instanced within remote threads via `spawn()`. Alias for `__Thread(constructor)`.
 */
export function Thread() {

    return (constructor: new (...args: any[]) => any) => __Thread(constructor)
}

// #endregion

// #region Main

export type MainInterface = {

    main(args: string[]): Promise<void> | void
}

/**
 * Registers a constructor as the application main entry point. This constructor
 * will be called automatically when the program run.
 */
export function __Main(constructor: new (...args: any[]) => MainInterface) {

    ThreadRegistry.registerMainConstructor(constructor)
}

/**
 * [decorator] Registers a constructor as the application main entry point. This constructor
 * will be called automatically when the program run. Alias for `__Main(constructor)`.
 */
export function Main() {

    return (constructor: new (...args: any[]) => MainInterface) => __Main(constructor)
}

// #endregion

// #region Spawn

export type FunctionKeys<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T]

export type ThreadInterfaceFunction<T> = T extends (...args: infer U) => infer R ? (...args: U) => R extends Promise<infer V> ? Promise<V> : Promise<R> : never

export type ThreadInterface<T> = { [K in FunctionKeys<T>]: ThreadInterfaceFunction<T[K]> } & { dispose: () => Promise<void> }


/**
 * Spawns a new worker thread with the given resourceLimits and constructor. The additional arguments given 
 * will be injected into the constructor when instanced in the remote thread. The constructor argument must
 * be registered as threadable or a `ConstructorNotThreadableError` error will be thrown.
 */
export function spawn<T extends any[], R>(resourceLimits: ThreadResourceLimits, constructor: new (...args: T) => R, ...args: T): ThreadInterface<R>

/**
 * Spawns a new worker thread with the given constructor. The additional arguments given will be
 * injected into the constructor when instanced in the remote thread. The constructor argument must
 * be registered as threadable or a `ConstructorNotThreadableError` error will be thrown.
 */
export function spawn<T extends any[], R>(constructor: new (...args: T) => R, ...args: T): ThreadInterface<R>

/** Spawns a new thread with the given arguments. */
export function spawn(...args: any[]): ThreadInterface<any> {
    const overloads = ThreadRegistry.getThreadKeyFromConstructor(args[0]) !== null ? [{}, ...args] : [...args]
    const resourceLimits = overloads.shift()
    const constructor = overloads.shift()
    return ThreadHandle.create(resourceLimits, constructor, ...overloads) as ThreadHandle & ThreadInterface<any>
}

// #endregion

ThreadLocal.start()
