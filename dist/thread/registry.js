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
exports.ThreadRegistry = exports.MultipleMainConstructorError = void 0;
// #region Errors
class MultipleMainConstructorError extends Error {
    constructor() {
        super('Multiple Main constructors found. Only one Main entry point is allowed.');
    }
}
exports.MultipleMainConstructorError = MultipleMainConstructorError;
/**
 * A registry of thread constructors. Used by the `ThreadLocal`
 * to instance the appropriate constructor in the remote thread.
 */
class ThreadRegistry {
    /** Returns the next threadKey. */
    static nextKey() {
        return this.ordinal++;
    }
    /** Registers the main constructor */
    static registerMainConstructor(constructor) {
        if (this.constructors.has(0))
            throw new MultipleMainConstructorError();
        this.constructors.set(0, constructor);
        this.reverse.set(constructor, 0);
    }
    /** Registers a worker constructor. */
    static registerWorkerConstructor(constructor) {
        const key = this.nextKey();
        this.constructors.set(key, constructor);
        this.reverse.set(constructor, key);
    }
    /** Returns a threadKey from the given constructor. If key not found, returns null. */
    static getThreadKeyFromConstructor(constructor) {
        const key = this.reverse.get(constructor);
        return key === undefined ? null : key;
    }
    /** Returns a threadKey from the given instance. If key not found, returns null. */
    static getThreadKeyFromInstance(instance) {
        if (instance === null || instance === undefined)
            return null;
        return this.getThreadKeyFromConstructor(instance.constructor);
    }
    /** Returns a constructor from the given threadKey. If key not found, returns null. */
    static getConstructorFromThreadKey(key) {
        return this.constructors.has(key)
            ? this.constructors.get(key)
            : null;
    }
    /** Returns the main constructor. If key not found, returns null. */
    static getMainConstructor() {
        return this.constructors.has(0)
            ? this.constructors.get(0)
            : null;
    }
}
exports.ThreadRegistry = ThreadRegistry;
ThreadRegistry.constructors = new Map();
ThreadRegistry.reverse = new WeakMap();
ThreadRegistry.ordinal = 1;
