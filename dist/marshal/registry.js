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
exports.MarshalRegistry = exports.DuplicateConstructorRegistration = void 0;
const reflect_1 = require("./reflect");
// #region Errors
class DuplicateConstructorRegistration extends Error {
    constructor(constructor) {
        const name = constructor.name;
        super(`MarshalRegistry: constructors can only be registered once. See constructor ${name}`);
    }
}
exports.DuplicateConstructorRegistration = DuplicateConstructorRegistration;
/**
 * Maintains a Registry of Marshalled constructors. This registry
 * is read by the MarshalEncoder, and written to from consumers
 * needing object Marshalling support. Internal consumers of this
 * registry are the channel `Queue`, `Sender` and `Receiver` types.
 */
class MarshalRegistry {
    /** Returns the next MarshalKey. */
    static nextKey() {
        return this.ordinal++;
    }
    /** Registers the given constructor as marshalled. */
    static registerConstructor(constructor) {
        if (this.reverse.has(constructor)) {
            throw new DuplicateConstructorRegistration(constructor);
        }
        const key = this.nextKey();
        this.constructors.set(key, constructor);
        this.reverse.set(constructor, key);
        return key;
    }
    /** Gets the constructor from the given MarshalKey. If not found, will returns null. */
    static getConstructorFromMarshalKey(key) {
        return this.constructors.get(key) || null;
    }
    /** Returns the MarshalKey for the given constructor. If not found, returns null. */
    static getMarshalKeyFromConstructor(constructor) {
        const key = this.reverse.get(constructor);
        return key === undefined ? null : key;
    }
    /** Returns the MarshalKey for this instance. If not found, returns null. */
    static getMarshalKeyFromInstance(instance) {
        if (instance === null || instance === undefined) {
            return null;
        }
        const key = this.reverse.get(instance.constructor);
        return key === undefined ? null : key;
    }
    /** Returns true if this constructor has been registered as marshalled. */
    static isConstructorMarshalled(constructor) {
        const key = this.reverse.get(constructor);
        return key !== undefined;
    }
    /** Deeply tests if the given value is marshalled. */
    static isInstanceMarshalled(instance) {
        // null and undefined can't be marshalled.
        if (instance === undefined || instance === null) {
            return false;
        }
        // If in registry, it definitely is marshalled.
        if (this.reverse.has(instance.constructor)) {
            return true;
        }
        // TypedArrays and SharedArrayBuffers can't be marshalled.
        if (reflect_1.Reflect.isTypedArray(instance)) {
            return false;
        }
        // Objects may have properties that are marshalled.
        else if (reflect_1.Reflect.isObject(instance)) {
            // perhaps its properties?
            for (const _value of Object.values(instance)) {
                if (this.isInstanceMarshalled(_value)) {
                    return true;
                }
            }
        }
        // Arrays may have elements that are marshalled.
        else if (reflect_1.Reflect.isArray(instance)) {
            // check all elements ...
            for (const _value of instance) {
                if (this.isInstanceMarshalled(_value)) {
                    return true;
                }
            }
        }
        // Not marshalled.
        return false;
    }
}
exports.MarshalRegistry = MarshalRegistry;
MarshalRegistry.constructors = new Map();
MarshalRegistry.reverse = new WeakMap();
MarshalRegistry.ordinal = 0;
