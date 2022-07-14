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
exports.MarshalTransferList = void 0;
const reflect_1 = require("./reflect");
/**
 * Searches an instance for any `transferList` candidates.
 * This is required for transmitting these objects via
 * `postMessage(...)`. An example of which is `MessagePort`.
 */
class MarshalTransferList {
    /** Search the given instance for `transferList` candidates. */
    static search(instance) {
        // null and undefined have none.
        if (instance === null || instance === undefined) {
            return [];
        }
        // A Message Port is.
        if (reflect_1.Reflect.isMessagePort(instance)) {
            return [instance];
        }
        // An Object may have some.
        if (reflect_1.Reflect.isObject(instance)) {
            const transferList = [];
            for (const key of Object.keys(instance)) {
                transferList.push(...this.search(instance[key]));
            }
            return transferList;
        }
        // An Array may have some.
        if (reflect_1.Reflect.isArray(instance)) {
            const transferList = [];
            for (const value of instance) {
                transferList.push(...this.search(value));
            }
            return transferList;
        }
        // None found.
        return [];
    }
}
exports.MarshalTransferList = MarshalTransferList;
