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
exports.MarshalEncoder = void 0;
const reflect_1 = require("./reflect");
const registry_1 = require("./registry");
// Intrinsics: Specialized Encoding Behavior
const INTRINSIC_MESSAGE_PORT = -1000;
const INTRINSIC_MAP = -1001;
/**
 * Provides Marshalling Services for ThreadBox. Allows constructors
 * to be registered as marshalled, and provides logic to encode and
 * decode objects crossing thread boundaries. MarshalEncoder is
 * leveraged by the Worker and Channel protocols to facilitate
 * complex message passing.
 */
class MarshalEncoder {
    /** Registers this constructor as marshalled. */
    static register(constructor) {
        return registry_1.MarshalRegistry.registerConstructor(constructor);
    }
    /** Returns true if this constructor is marshallable */
    static isConstructorMarshalled(constructor) {
        return registry_1.MarshalRegistry.isConstructorMarshalled(constructor);
    }
    /** Returns true if this instance is marshallable */
    static isInstanceMarshalled(instance) {
        if (instance === null || instance === undefined) {
            return false;
        }
        if (!instance.constructor) {
            return false;
        }
        return registry_1.MarshalRegistry.isConstructorMarshalled(instance.constructor);
    }
    /** Encodes the given instance into a marshalled object. */
    static encode(instance) {
        if (instance === null || instance === undefined) {
            return [null, null];
        }
        // Intrinsic: Encodes for 'MessagePort'. Automatic.
        if (reflect_1.Reflect.isMessagePort(instance)) {
            return [INTRINSIC_MESSAGE_PORT, instance];
        }
        // Intrinsic: Encodes for Map.
        else if (reflect_1.Reflect.isMapType(instance)) {
            const encoded_map = new Map();
            for (const [key, value] of instance) {
                encoded_map.set(key, this.encode(value));
            }
            const entries = [...encoded_map.entries()];
            return [INTRINSIC_MAP, entries];
        }
        // Encodes for TypeArray and SharedArray marshal. Automatic.
        else if (reflect_1.Reflect.isTypedArray(instance)) {
            return [null, instance];
        }
        // Encodes for Object.
        else if (reflect_1.Reflect.isObject(instance)) {
            const entries = Object.entries(instance);
            const object = entries.reduce((object, [key, value]) => {
                return { ...object, [key]: this.encode(value) };
            }, {});
            // Lookup marshalKey from instance. Will be either MarshalKey | null
            const marshalKey = registry_1.MarshalRegistry.getMarshalKeyFromInstance(instance);
            return [marshalKey, object];
        }
        // Encodes for Array.
        else if (reflect_1.Reflect.isArray(instance)) {
            return [null, instance.map((value) => this.encode(value))];
        }
        // Not Encoded
        else {
            return [null, instance];
        }
    }
    /** Decodes the given marshalled object.  */
    static decode(encoded) {
        const [marshalKey, instance] = encoded;
        // Instrinsic: Decodes for type 'MessagePort'.
        if (marshalKey === INTRINSIC_MESSAGE_PORT) {
            return instance;
        }
        // Instrinsic: Decodes for type 'Map'.
        if (marshalKey === INTRINSIC_MAP) {
            const encoded_map = new Map(instance);
            const map = new Map();
            for (const [key, value] of encoded_map) {
                map.set(key, this.decode(value));
            }
            return map;
        }
        // Decodes for TypeArray and SharedBuffer. Automatic.
        else if (reflect_1.Reflect.isTypedArray(instance)) {
            return instance;
        }
        // Decodes for Object. Automatic.
        else if (reflect_1.Reflect.isObject(instance)) {
            const entries = Object.entries(instance);
            const object = entries.reduce((object, [key, value]) => {
                return { ...object, [key]: this.decode(value) };
            }, {});
            // If marshalled, the registry will contain a constructor.
            const constructor = marshalKey !== null ? registry_1.MarshalRegistry.getConstructorFromMarshalKey(marshalKey) : null;
            return (constructor !== null)
                ? Object.assign(Object.create(constructor.prototype), object)
                : object;
        }
        // Decodes for Array.
        else if (reflect_1.Reflect.isArray(instance)) {
            return instance.map((value) => this.decode(value));
        }
        // Not Decoded
        else {
            return instance;
        }
    }
}
exports.MarshalEncoder = MarshalEncoder;
