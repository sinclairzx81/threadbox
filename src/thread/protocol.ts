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

import { MarshalEncoder, MarshalTransferList } from '../marshal/index'
import { ThreadKey } from './registry'

// #region Errors

export class ThreadProtocolEncodeError extends Error {
    constructor(data: any) {
        const json = JSON.stringify(data)
        super(`Unable to encode protocol message: ${json}`)
    }
}
export class ThreadProtocolDecodeError extends Error {
    constructor(data: any) {
        const json = JSON.stringify(data)
        super(`Unable to decode protocol message: ${json}`)
    }
}

// #endregion

type FunctionKey = string;

// Protocol
//
// The following is the protocol used to communicate with Workers.
// This module encodes and decodes several operations that are used 
// construct, execute and dispose of workers.

// #region Commands

/** Parent > Worker */ export type Construct = { kind: 'construct', ordinal: number, threadKey: ThreadKey, args: any[] };
/** Parent > Worker */ export type Execute   = { kind: 'execute',   ordinal: number, functionKey: FunctionKey, args: any[] };
/** Worker < Parent */ export type Result    = { kind: 'result',    ordinal: number, result: any };
/** Worker < Parent */ export type Error     = { kind: 'error',     ordinal: number, error: string };
/** Parent > Worker */ export type Dispose   = { kind: 'dispose',   ordinal: number };
/** Worker > Parent */ export type Disposed  = { kind: 'disposed',  ordinal: number };
/** Parent > Worker */ export type Terminate = { kind: 'terminate' };
export type Command   = Construct | Execute | Result | Error | Dispose | Disposed | Terminate

// #endregion

// #region Message

export type Encoded = { kind: 'default' | 'marshalled', data: any };
/** Parent > Worker */ export type ConstructMessage = { kind: 'construct', ordinal: number, threadKey: ThreadKey, args: Encoded[] };
/** Parent > Worker */ export type ExecuteMessage   = { kind: 'execute',   ordinal: number, functionKey: FunctionKey, args: Encoded[] };
/** Worker < Parent */ export type ResultMessage    = { kind: 'result',    ordinal: number, result: Encoded };
/** Worker < Parent */ export type ErrorMessage     = { kind: 'error',     ordinal: number, error: string };
/** Parent > Worker */ export type DisposeMessage   = { kind: 'dispose',   ordinal: number };
/** Worker < Parent */ export type DisposedMessage  = { kind: 'disposed',  ordinal: number };
/** Parent > Worker */ export type TerminateMessage = { kind: 'terminate' };
export type Message = ConstructMessage | ExecuteMessage | ResultMessage | ErrorMessage | DisposeMessage | DisposedMessage | TerminateMessage

// #endregion

/**
 * A protocol encoder for messages exchanged between worker threads.
 * Leveraged exclusively by the `LocalThread` and `ThreadHandle`.
 */
export class ThreadProtocol {

    // #region Encode

    /** Encodes the `construct` protocol message. */
    private static encodeConstruct(command: Construct): ConstructMessage {
        return {
            ...command,
            args: command.args.map((arg: any) => {
                if (MarshalEncoder.isInstanceMarshalled(arg)) {
                    return {
                        kind: 'marshalled',
                        data: MarshalEncoder.encode(arg)
                    }
                } else {
                    return {
                        kind: 'default',
                        data: arg
                    }
                }
            })
        }
    }
    /** Encodes the `execute` protocol message. */
    private static encodeExecute(command: Execute): ExecuteMessage {
        return {
            ...command,
            args: command.args.map(arg => {
                if (MarshalEncoder.isInstanceMarshalled(arg)) {
                    return {
                        kind: 'marshalled',
                        data: MarshalEncoder.encode(arg)
                    }
                } else {
                    return {
                        kind: 'default',
                        data: arg
                    }
                }
            })
        }
    }
    /** Encodes the `result` protocol message. */
    private static encodeResult(command: Result): ResultMessage {
        return {
            ...command,
            result: MarshalEncoder.isInstanceMarshalled(command.result)
                ? {
                    kind: 'marshalled',
                    data: MarshalEncoder.encode(command.result),
                } : {
                    kind: 'default',
                    data: command.result,
                }
        }
    }
    /** Encodes the `error` protocol message. */
    private static encodeError(command: Error): ErrorMessage {
        return { ...command }
    }
    /** Encodes the `dispose` protocol message. */
    private static encodeDispose(command: Dispose): DisposeMessage {
        return { ...command }
    }
    /** Encodes the `disposed` protocol message. */
    public static encodeDisposed(command: Disposed): DisposedMessage {
        return { ...command }
    }
    /** Encodes the `terminate` protocol message. */
    private static encodeTerminate(command: Terminate): TerminateMessage {
        return { ...command }
    }
    /** Encodes the given `Command` as a protocol message. */
    public static encode(command: Command): [Message, any[]] {
        switch (command.kind) {
            case 'construct': return [this.encodeConstruct(command), MarshalTransferList.search(command.args)]
            case 'execute':   return [this.encodeExecute(command),   MarshalTransferList.search(command.args)]
            case 'result':    return [this.encodeResult(command),    MarshalTransferList.search(command.result)]
            case 'error':     return [this.encodeError(command),     MarshalTransferList.search(command.error)]
            case 'dispose':   return [this.encodeDispose(command),   []]
            case 'disposed':  return [this.encodeDisposed(command),  []]
            case 'terminate': return [this.encodeTerminate(command), []]
            default: throw new ThreadProtocolEncodeError(command)
        }
    }

    // #endregion

    // #region Decode

    /** Decodes the `construct` protocol message. */
    private static decodeConstruct(message: ConstructMessage): Construct {
        return {
            ...message,
            args: message.args.map(param => {
                if (param.kind === 'marshalled') {
                    return MarshalEncoder.decode(param.data)
                } else {
                    return param.data
                }
            })
        }
    }
    /** Decodes the `execute` protocol message. */
    private static decodeExecute(message: ExecuteMessage): Execute {
        return {
            ...message,
            args: message.args.map(param => {
                if (param.kind === 'marshalled') {
                    return MarshalEncoder.decode(param.data)
                } else {
                    return param.data
                }
            })
        }
    }
    /** Decodes the `result` protocol message. */
    private static decodeResult(message: ResultMessage): Result {
        return {
            ...message,
            result: message.result.kind === 'marshalled'
                ? MarshalEncoder.decode(message.result.data)
                : message.result.data
        }
    }
    /** Decodes the `error` protocol message. */
    private static decodeError(message: ErrorMessage): Error {
        return { ...message }
    }
    /** Decodes the `dispose` protocol message. */
    private static decodeDispose(message: DisposeMessage): Dispose {
        return { ...message }
    }
    /** Decodes the `disposed` protocol message. */
    private static decodeDisposed(message: DisposedMessage): Disposed {
        return { ...message }
    }
    /** Decodes the `terminate` protocol message. */
    private static decodeTerminate(message: TerminateMessage): Terminate {
        return { ...message }
    }
    /** Decodes a protocol message. */
    public static decode(message: Message): Command {
        switch (message.kind) {
            case 'construct': return this.decodeConstruct(message)
            case 'execute':   return this.decodeExecute(message)
            case 'result':    return this.decodeResult(message)
            case 'error':     return this.decodeError(message)
            case 'dispose':   return this.decodeDispose(message)
            case 'disposed':  return this.decodeDisposed(message)
            case 'terminate': return this.decodeTerminate(message)
            default: throw new ThreadProtocolDecodeError(message)
        }
    }

    // #endregion
}
