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
exports.ThreadProtocol = exports.ThreadProtocolDecodeError = exports.ThreadProtocolEncodeError = void 0;
const index_1 = require("../marshal/index");
// #region Errors
class ThreadProtocolEncodeError extends Error {
    constructor(data) {
        const json = JSON.stringify(data);
        super(`Unable to encode protocol message: ${json}`);
    }
}
exports.ThreadProtocolEncodeError = ThreadProtocolEncodeError;
class ThreadProtocolDecodeError extends Error {
    constructor(data) {
        const json = JSON.stringify(data);
        super(`Unable to decode protocol message: ${json}`);
    }
}
exports.ThreadProtocolDecodeError = ThreadProtocolDecodeError;
// #endregion
/**
 * A protocol encoder for messages exchanged between worker threads.
 * Leveraged exclusively by the `LocalThread` and `ThreadHandle`.
 */
class ThreadProtocol {
    // #region Encode
    /** Encodes the `construct` protocol message. */
    static encodeConstruct(command) {
        return {
            ...command,
            args: command.args.map((arg) => {
                if (index_1.MarshalEncoder.isInstanceMarshalled(arg)) {
                    return {
                        kind: 'marshalled',
                        data: index_1.MarshalEncoder.encode(arg)
                    };
                }
                else {
                    return {
                        kind: 'default',
                        data: arg
                    };
                }
            })
        };
    }
    /** Encodes the `execute` protocol message. */
    static encodeExecute(command) {
        return {
            ...command,
            args: command.args.map(arg => {
                if (index_1.MarshalEncoder.isInstanceMarshalled(arg)) {
                    return {
                        kind: 'marshalled',
                        data: index_1.MarshalEncoder.encode(arg)
                    };
                }
                else {
                    return {
                        kind: 'default',
                        data: arg
                    };
                }
            })
        };
    }
    /** Encodes the `result` protocol message. */
    static encodeResult(command) {
        return {
            ...command,
            result: index_1.MarshalEncoder.isInstanceMarshalled(command.result)
                ? {
                    kind: 'marshalled',
                    data: index_1.MarshalEncoder.encode(command.result),
                } : {
                kind: 'default',
                data: command.result,
            }
        };
    }
    /** Encodes the `error` protocol message. */
    static encodeError(command) {
        return { ...command };
    }
    /** Encodes the `dispose` protocol message. */
    static encodeDispose(command) {
        return { ...command };
    }
    /** Encodes the `disposed` protocol message. */
    static encodeDisposed(command) {
        return { ...command };
    }
    /** Encodes the `terminate` protocol message. */
    static encodeTerminate(command) {
        return { ...command };
    }
    /** Encodes the given `Command` as a protocol message. */
    static encode(command) {
        switch (command.kind) {
            case 'construct': return [this.encodeConstruct(command), index_1.MarshalTransferList.search(command.args)];
            case 'execute': return [this.encodeExecute(command), index_1.MarshalTransferList.search(command.args)];
            case 'result': return [this.encodeResult(command), index_1.MarshalTransferList.search(command.result)];
            case 'error': return [this.encodeError(command), index_1.MarshalTransferList.search(command.error)];
            case 'dispose': return [this.encodeDispose(command), []];
            case 'disposed': return [this.encodeDisposed(command), []];
            case 'terminate': return [this.encodeTerminate(command), []];
            default: throw new ThreadProtocolEncodeError(command);
        }
    }
    // #endregion
    // #region Decode
    /** Decodes the `construct` protocol message. */
    static decodeConstruct(message) {
        return {
            ...message,
            args: message.args.map(param => {
                if (param.kind === 'marshalled') {
                    return index_1.MarshalEncoder.decode(param.data);
                }
                else {
                    return param.data;
                }
            })
        };
    }
    /** Decodes the `execute` protocol message. */
    static decodeExecute(message) {
        return {
            ...message,
            args: message.args.map(param => {
                if (param.kind === 'marshalled') {
                    return index_1.MarshalEncoder.decode(param.data);
                }
                else {
                    return param.data;
                }
            })
        };
    }
    /** Decodes the `result` protocol message. */
    static decodeResult(message) {
        return {
            ...message,
            result: message.result.kind === 'marshalled'
                ? index_1.MarshalEncoder.decode(message.result.data)
                : message.result.data
        };
    }
    /** Decodes the `error` protocol message. */
    static decodeError(message) {
        return { ...message };
    }
    /** Decodes the `dispose` protocol message. */
    static decodeDispose(message) {
        return { ...message };
    }
    /** Decodes the `disposed` protocol message. */
    static decodeDisposed(message) {
        return { ...message };
    }
    /** Decodes the `terminate` protocol message. */
    static decodeTerminate(message) {
        return { ...message };
    }
    /** Decodes a protocol message. */
    static decode(message) {
        switch (message.kind) {
            case 'construct': return this.decodeConstruct(message);
            case 'execute': return this.decodeExecute(message);
            case 'result': return this.decodeResult(message);
            case 'error': return this.decodeError(message);
            case 'dispose': return this.decodeDispose(message);
            case 'disposed': return this.decodeDisposed(message);
            case 'terminate': return this.decodeTerminate(message);
            default: throw new ThreadProtocolDecodeError(message);
        }
    }
}
exports.ThreadProtocol = ThreadProtocol;
