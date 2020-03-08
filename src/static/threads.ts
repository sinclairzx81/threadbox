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

// #region Errors

export class MultipleMainConstructorError extends Error {
    constructor() {
        super('Multiple Main constructors found. Only one Main entry point is allowed.')
    }
}

// #endregion

// #region Thread Key

const nextKey = (() => { let index = 0; return () => (index++).toString() })()

// #endregion

// #region Registry

export type ConstructorFunction = new (...args: any[]) => any

const constructors = new Map<string, ConstructorFunction>()

const reverse = new WeakMap<ConstructorFunction, string>()

export function register_thread_constructor(constructor: ConstructorFunction) {
    const key = nextKey()
    constructors.set(key, constructor)
    reverse.set(constructor, key)
}

export function register_main_constructor(constructor: ConstructorFunction) {
    const key = 'main'
    if (constructors.has(key)) {
        throw new MultipleMainConstructorError()
    }
    constructors.set(key, constructor)
    reverse.set(constructor, key)
}


export function lookup_thread_key(constructor: ConstructorFunction): string | undefined {
    return reverse.get(constructor)
}

export function get_thread_constructor(key: string): ConstructorFunction | undefined {
    return constructors.get(key)
}

export function get_main_constructor(): ConstructorFunction | undefined {
    return constructors.get('main')
}

// #endregion