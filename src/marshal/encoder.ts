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

import { Reflect }         from './reflect'
import { MarshalRegistry } from './registry'

// #region Marshal Encoding Scheme
//
// The following outlines the high level encoding 
// scheme for marshalled class instances. This 
// protocol is coupled to a small registry of known 
// class constructors which are used to reconstruct
// class instances across thread boundaries.
//
// Each field in a class is transformed into a
// tuple [marshalKey, value] where [null, value]
// indicates no marshalling, [key, value] indicates 
// there's been a registered class constructor and 
// the decoder should instance it with the given
// value. As follows ...
//
// class Bar {
//     c = 30
//     d = 40
// }
// class Foo {
//     x = new Bar()
//     y = [new Bar(), 50]
//     a = 10
//     b = 20
// }
//
// Non-Encoded
//
// const non_encoded = {
//     x: { c: 30, d: 40 },
//     y: [{c: 30, d: 40 }, 50 ],
//     a: 10,
//     b: 20
// }
//
// Encoded
//
// const encoded = ['<transfer-key>', {
//     x: ['<transfer-key>', {
//         c: [null, 30],
//         d: [null, 40]
//     }],
//     y: [null, [
//         ['<transfer-key>', {
//             c: [null, 30],
//             d: [null, 40]
//         }],
//         [null, 50]
//     ]],
//     a: [null, 10],
//     b: [null, 20]
// }]
//
// #endregion

// #region Registry

// The above data structure. Requires type mapping. Todo.
export type Marshalled = any

// Intrinsics: Specialized Encoding Behavior
const INTRINSIC_MESSAGE_PORT = -1000
const INTRINSIC_MAP          = -1001

type Constructor = new (...args: any[]) => any

/**
 * Provides Marshalling Services for ThreadBox. Allows constructors
 * to be registered as marshalled, and provides logic to encode and
 * decode objects crossing thread boundaries. MarshalEncoder is
 * leveraged by the Worker and Channel protocols to facilitate
 * complex message passing.
 */
export class MarshalEncoder {

    /** Registers this constructor as marshalled. */
    public static register(constructor: Constructor): number {
        return MarshalRegistry.registerConstructor(constructor)
    }

    /** Returns true if this constructor is marshallable */
    public static isConstructorMarshalled(constructor: Constructor): boolean {
        return MarshalRegistry.isConstructorMarshalled(constructor)
    }

    /** Returns true if this instance is marshallable */
    public static isInstanceMarshalled(instance: any): boolean {
        if(instance === null || instance === undefined) { return false }
        if(!instance.constructor) { return false }
        return MarshalRegistry.isConstructorMarshalled(instance.constructor)
    }

    /** Encodes the given instance into a marshalled object. */
    public static encode(instance: any): Marshalled {
        if (instance === null || instance === undefined) {
            return [null, null]
        }
        // Intrinsic: Encodes for 'MessagePort'. Automatic.
        if(Reflect.isMessagePort(instance)) {
            return [INTRINSIC_MESSAGE_PORT, instance]
        }
        // Intrinsic: Encodes for Map.
        else if(Reflect.isMapType(instance)) {
            const encoded_map = new Map()
            for(const [key, value] of instance) {
                encoded_map.set(key, this.encode(value))
            }
            const entries = [...encoded_map.entries()]
            return [INTRINSIC_MAP, entries]
        }
        // Encodes for TypeArray and SharedArray marshal. Automatic.
        else if (Reflect.isTypedArray(instance)) {
            return [null, instance]
        }
        // Encodes for Object.
        else if (Reflect.isObject(instance)) {
            const entries = Object.entries(instance as object)
            const object = entries.reduce((object, [key, value]) => {
                return { ...object, [key]: this.encode(value) }
            }, {} as any)
            // Lookup marshalKey from instance. Will be either MarshalKey | null
            const marshalKey = MarshalRegistry.getMarshalKeyFromInstance(instance)
            return [marshalKey, object]
        } 
        // Encodes for Array.
        else if (Reflect.isArray(instance)) {
            return [null, instance.map((value: any) => this.encode(value))]
        } 
        // Not Encoded
        else {
            return [null, instance]
        }
    }

    /** Decodes the given marshalled object.  */
    public static decode(encoded: Marshalled): any {
        const [marshalKey, instance] = encoded
        // Instrinsic: Decodes for type 'MessagePort'.
        if(marshalKey === INTRINSIC_MESSAGE_PORT) {
            return instance
        } 
        // Instrinsic: Decodes for type 'Map'.
        if(marshalKey === INTRINSIC_MAP) {
            const encoded_map = new Map(instance)
            const map = new Map()
            for(const [key, value] of encoded_map) {
                map.set(key, this.decode(value))
            }
            return map
        } 
        // Decodes for TypeArray and SharedBuffer. Automatic.
        else if (Reflect.isTypedArray(instance)) {
            return instance
        }
        // Decodes for Object. Automatic.
        else if (Reflect.isObject(instance)) {
            const entries = Object.entries(instance as object)
            const object = entries.reduce((object, [key, value]) => {
                return { ...object, [key]: this.decode(value) }
            }, {} as any)
            // If marshalled, the registry will contain a constructor.
            const constructor = marshalKey !== null ? MarshalRegistry.getConstructorFromMarshalKey(marshalKey) : null
            return (constructor !== null)
                ? Object.assign(Object.create(constructor.prototype), object) 
                : object
        }
        // Decodes for Array.
        else if (Reflect.isArray(instance)) {
            return instance.map((value: any) => this.decode(value))
        }
        // Not Decoded
        else {
            return instance
        }
    }
}