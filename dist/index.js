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
exports.spawn = exports.Main = exports.__Main = exports.Thread = exports.__Thread = exports.Marshal = exports.__Marshal = exports.MutexLock = exports.Mutex = exports.into = exports.EOF = exports.Receiver = exports.Sender = exports.select = exports.channel = void 0;
const index_1 = require("./thread/index");
const index_2 = require("./marshal/index");
var index_3 = require("./channel/index");
Object.defineProperty(exports, "channel", { enumerable: true, get: function () { return index_3.channel; } });
Object.defineProperty(exports, "select", { enumerable: true, get: function () { return index_3.select; } });
Object.defineProperty(exports, "Sender", { enumerable: true, get: function () { return index_3.Sender; } });
Object.defineProperty(exports, "Receiver", { enumerable: true, get: function () { return index_3.Receiver; } });
Object.defineProperty(exports, "EOF", { enumerable: true, get: function () { return index_3.EOF; } });
var index_4 = require("./async/index");
Object.defineProperty(exports, "into", { enumerable: true, get: function () { return index_4.into; } });
var index_5 = require("./mutex/index");
Object.defineProperty(exports, "Mutex", { enumerable: true, get: function () { return index_5.Mutex; } });
Object.defineProperty(exports, "MutexLock", { enumerable: true, get: function () { return index_5.MutexLock; } });
// #region Marshal
/**
 * Registers this class as marshalled. This will enable instances
 * of this class to be sent and re-constructed when passed
 * between threads boundaries.
 */
function __Marshal(constructor) {
    index_2.MarshalEncoder.register(constructor);
}
exports.__Marshal = __Marshal;
/**
 * [decorator] Registers this class as marshalled. This will enable instances
 * of this class to be sent and re-constructed when passed
 * between threads boundaries. Alias for `__Marshal(constructor)`
 */
function Marshal() {
    return (constructor) => __Marshal(constructor);
}
exports.Marshal = Marshal;
// #endregion
// #region Thread
/**
 * Registers a constructor as threadable. This allows this constructor to be
 * instanced within remote worker threads via `spawn()`
 */
function __Thread(constructor) {
    index_1.ThreadRegistry.registerWorkerConstructor(constructor);
}
exports.__Thread = __Thread;
/**
 * [decorator] Registers a constructor as threadable. This allows this constructor to be
 * instanced within remote threads via `spawn()`. Alias for `__Thread(constructor)`.
 */
function Thread() {
    return (constructor) => __Thread(constructor);
}
exports.Thread = Thread;
/**
 * Registers a constructor as the application main entry point. This constructor
 * will be instanced automatically when the program is run.
 */
function __Main(constructor) {
    index_1.ThreadRegistry.registerMainConstructor(constructor);
}
exports.__Main = __Main;
/**
 * [decorator] Registers a constructor as the application main entry point. This constructor
 * will be instanced automatically when the program is run. Alias for `__Main(constructor)`.
 */
function Main() {
    return (constructor) => __Main(constructor);
}
exports.Main = Main;
/** Spawns a new thread with the given arguments. */
function spawn(...args) {
    const overloads = index_1.ThreadRegistry.getThreadKeyFromConstructor(args[0]) !== null ? [{}, ...args] : [...args];
    const resourceLimits = overloads.shift();
    const constructor = overloads.shift();
    return index_1.ThreadHandle.create(resourceLimits, constructor, ...overloads);
}
exports.spawn = spawn;
// #endregion
index_1.ThreadLocal.start();
