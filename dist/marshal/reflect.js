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
exports.Reflect = void 0;
const worker_threads_1 = require("worker_threads");
/**
 * Provides reflection services for ThreadBox.
 */
class Reflect {
    /** Tests if this value is an object that can be enumerated. */
    static isObject(value) {
        return typeof value === 'object' && !Array.isArray(value);
    }
    /** Tests if this value is an Array. */
    static isArray(value) {
        return typeof value === 'object' && Array.isArray(value);
    }
    /** Test if this value is a Map. */
    static isMapType(value) {
        const constructor = value.constructor;
        return constructor === Map;
    }
    /** Tests if this value is a TypedArray or SharedArrayBuffer  */
    static isTypedArray(value) {
        if (value === null || value === undefined)
            return false;
        const constructor = value.constructor;
        return constructor === Int8Array ||
            constructor === Int16Array ||
            constructor === Int32Array ||
            constructor === Uint8Array ||
            constructor === Uint16Array ||
            constructor === Uint32Array ||
            constructor === Float32Array ||
            constructor === Float64Array ||
            constructor === Uint8ClampedArray ||
            constructor === SharedArrayBuffer;
    }
    /** Tests if this value is a TransferList item. */
    static isMessagePort(value) {
        if (value === null || value === undefined)
            return false;
        const constructor = value.constructor;
        return constructor === worker_threads_1.MessagePort;
    }
}
exports.Reflect = Reflect;
