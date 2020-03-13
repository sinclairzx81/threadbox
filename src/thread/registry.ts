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

// #region Errors

export class MultipleMainConstructorError extends Error {
    constructor() {
        super('Multiple Main constructors found. Only one Main entry point is allowed.')
    }
}

// #endregion

export type Constructor = new (...args: any[]) => any
export type ThreadKey   = number

/**
 * A registry of thread constructors. Used by the `ThreadLocal`
 * to instance the appropriate constructor in the remote thread.
 */
export class ThreadRegistry {
    private static readonly constructors = new Map<ThreadKey, Constructor>()
    private static readonly reverse = new WeakMap<Constructor, ThreadKey>()
    private static ordinal: ThreadKey = 1

    /** Returns the next threadKey. */
    private static nextKey(): ThreadKey {
        return this.ordinal++
    }
    /** Registers the main constructor */
    public static registerMainConstructor(constructor: Constructor) {
        if(this.constructors.has(0)) throw new MultipleMainConstructorError()
        this.constructors.set(0, constructor)
        this.reverse.set(constructor, 0)
    }

    /** Registers a worker constructor. */
    public static registerWorkerConstructor(constructor: Constructor) {
        const key = this.nextKey()
        this.constructors.set(key, constructor)
        this.reverse.set(constructor, key)
    }

    /** Returns a threadKey from the given constructor. If key not found, returns null. */
    public static getThreadKeyFromConstructor(constructor: any): ThreadKey | null {
        const key = this.reverse.get(constructor)
        return key === undefined ? null : key
    }

    /** Returns a threadKey from the given instance. If key not found, returns null. */
    public static getThreadKeyFromInstance(instance: any): ThreadKey | null {
        if(instance === null || instance === undefined) return null
        return this.getThreadKeyFromConstructor(instance.constructor)
    }
    
    /** Returns a constructor from the given threadKey. If key not found, returns null. */
    public static getConstructorFromThreadKey(key: ThreadKey): Constructor | null {
        return this.constructors.has(key)
            ? this.constructors.get(key)!
            : null
    }

    /** Returns the main constructor. If key not found, returns null. */
    public static getMainConstructor(): Constructor | null {
        return this.constructors.has(0)
            ? this.constructors.get(0)!
            : null
    }
}
