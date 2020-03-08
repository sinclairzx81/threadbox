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

import { is_array, is_native, is_object } from './reflect'

// #region Class Instance Marshal Encoding
//
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


// #region Transfer Key

const nextKey = (() => { let index = 0; return () => (index++).toString() })()

// #endregion

// #region Registry

export type ConstructorFunction = new (...args: any[]) => any

const constructors = new Map<string, ConstructorFunction>()
const reverse = new WeakMap<ConstructorFunction, string>()

export function register_marshal_constructor(constructor: ConstructorFunction) {

    const key = nextKey()

    constructors.set(key, constructor)

    reverse.set(constructor, key)
}

// #region Reverse Lookup

function get_marshalled_as(instance: any): string | null {

    return reverse.get(instance.constructor) || null
}

// #endregion

export function is_mashallable(value: any): boolean {

    if (value === undefined || value === null) {

        return false
    }

    if (is_native(value)) {

        return false

    } else if (is_object(value)) {

        if (get_marshalled_as(value) != null) {

            return true
        }

        for (const [_, val] of Object.entries(value)) {

            if (is_mashallable(val)) {

                return true
            }
        }

    } else if (is_array(value)) {

        for (const val of value) {

            if (is_mashallable(val)) {
                
                return true
            }
        }
    } else {

        if (get_marshalled_as(value) != null) {

            return true
        }
    }
    return false
}

/** Encodes value as marshalled. */
export function encode<T extends any>(value: T): [null | string, any] {

    if (is_native(value)) {

        return [null, value]

    } else if (is_object(value)) {

        const object = Object.entries(value).reduce((object: any, pair) => {

            object[pair[0]] = encode(pair[1])

            return object

        }, {}) as any

        return [get_marshalled_as(value), object]

    } else if (is_array(value)) {

        return [null, value.map((value: any) => encode(value))]

    } else {

        return [null, value]
    }
}

/** Decodes value from marshalled. */
export function decode<T extends any>(tuple: any): T {

    const [key, value] = tuple

    if (is_native(value)) {

        return value

    } else if (is_object(value)) {

        const object = Object.entries(value).reduce((object: any, pair) => {

            object[pair[0]] = decode(pair[1])

            return object

        }, {}) as any

        if (constructors.has(key)) {

            const constructor = constructors.get(key)!

            return Object.assign(

                Object.create(constructor.prototype),

                object
            )
        }
        return object

    } else if (is_array(value)) {

        return value.map((value: any) => decode(value))

    } else {
        
        return value
    }
}

// #endregion