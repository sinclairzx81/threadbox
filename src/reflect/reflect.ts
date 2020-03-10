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

import { MessagePort } from 'worker_threads'

/**
 * Provides reflection services for ThreadBox.
 */
export class Reflect {

    /** Tests if this value is an object that can be enumerated. */
    public static isObject(value: any): boolean {
        return typeof value === 'object' && !Array.isArray(value)
    }

    /** Tests if this value is an Array. */
    public static isArray(value: any): boolean {
        return typeof value === 'object' && Array.isArray(value)
    }

    /** Test if this value is a Map. */
    public static isMapType(value: any): boolean {
        const constructor = value.constructor
        return constructor === Map
    }

    /** Tests if this value is a TypedArray or SharedArrayBuffer  */
    public static isTypedArray(value: any): boolean {
        if (value === null || value === undefined) return false
        const constructor = value.constructor
        return constructor === Int8Array ||
               constructor === Int16Array ||
               constructor === Int32Array ||
               constructor === Uint8Array ||
               constructor === Uint16Array ||
               constructor === Uint32Array ||
               constructor === Float32Array || 
               constructor === Float64Array ||
               constructor === Uint8ClampedArray ||
               constructor === SharedArrayBuffer
    }

    /** Tests if this value is a TransferList item. */
    public static isMessagePort(value: any): boolean {
        if (value === null || value === undefined) return false
        const constructor = value.constructor
        return constructor === MessagePort
    }
    
}