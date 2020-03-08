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

import { encode, decode, is_mashallable } from './marshal'

// #region Commands

export type Command = ConstructCommand | ExecuteCommand | ResultCommand | ErrorCommand | DisposeCommand | DisposedCommand | TerminateCommand
export interface ConstructCommand { kind: 'construct', id: number, key: string, params: any[] }
export interface ExecuteCommand { kind: 'execute', id: number, key: string, params: any[] }
export interface ResultCommand { kind: 'result', id: number, result: any }
export interface ErrorCommand { kind: 'error', id: number, error: string }
export interface DisposeCommand { kind: 'dispose', id: number }
export interface DisposedCommand { kind: 'disposed', id: number }
export interface TerminateCommand { kind: 'terminate' }

// #endregion

// #region Message

export interface MessageObject { kind: 'default' | 'marshalled', data: any }
export type Message = ConstructMessage | ExecuteMessage | ResultMessage | ErrorMessage | DisposeMessage | DisposedMessage | TerminateMessage
export interface ConstructMessage { kind: 'construct', id: number, key: string, params: MessageObject[] }
export interface ExecuteMessage { kind: 'execute', id: number, key: string, params: MessageObject[] }
export interface ResultMessage { kind: 'result', id: number, result: MessageObject }
export interface ErrorMessage { kind: 'error', id: number, error: string }
export interface DisposeMessage { kind: 'dispose', id: number }
export interface DisposedMessage { kind: 'disposed', id: number }
export interface TerminateMessage { kind: 'terminate' }

// #endregion

export class Protocol {


    // #region Encode

    private static encode_construct(command: ConstructCommand): ConstructMessage {
        return {
            ...command,
            params: command.params.map((param: any) => {
                if (is_mashallable(param)) {
                    return {
                        kind: 'marshalled',
                        data: encode(param)
                    }
                } else {
                    return {
                        kind: 'default',
                        data: param
                    }
                }
            })
        }
    }

    private static encode_execute(command: ExecuteCommand): ExecuteMessage {
        return {
            ...command,
            params: command.params.map(param => {
                if (is_mashallable(param)) {
                    return {
                        kind: 'marshalled',
                        data: encode(param)
                    }
                } else {
                    return {
                        kind: 'default',
                        data: param
                    }
                }
            })
        }
    }

    private static encode_result(command: ResultCommand): ResultMessage {
        return {
            ...command,
            result: is_mashallable(command.result)
                ? {
                    kind: 'marshalled',
                    data: encode(command.result),
                } : {

                    kind: 'default',

                    data: command.result,
                }
        }
    }

    private static encode_error(command: ErrorCommand): ErrorMessage {
        return { ...command }
    }

    private static encode_dispose(command: DisposeCommand): DisposeMessage {
        return { ...command }
    }

    public static encode_disposed(command: DisposedCommand): DisposedMessage {
        return { ...command }
    }

    private static encode_terminate(command: TerminateCommand): TerminateMessage {
        return { ...command }
    }

    public static encode(command: Command): Message {
        switch (command.kind) {
            case 'construct': return this.encode_construct(command)
            case 'execute': return this.encode_execute(command)
            case 'result': return this.encode_result(command)
            case 'error': return this.encode_error(command)
            case 'dispose': return this.encode_dispose(command)
            case 'disposed': return this.encode_disposed(command)
            case 'terminate': return this.encode_terminate(command)
            default: throw Error('encode: Invalid protocol command kind')
        }
    }

    // #endregion

    // #region Decode

    private static decode_construct(message: ConstructMessage): ConstructCommand {
        return {
            ...message,
            params: message.params.map(param => {
                if (param.kind === 'marshalled') {
                    return decode(param.data)
                } else {
                    return param.data
                }
            })
        }
    }

    private static decode_execute(message: ExecuteMessage): ExecuteCommand {
        return {
            ...message,
            params: message.params.map(param => {
                if (param.kind === 'marshalled') {
                    return decode(param.data)
                } else {
                    return param.data
                }
            })
        }
    }

    private static decode_result(message: ResultMessage): ResultCommand {
        return {
            ...message,
            result: message.result.kind === 'marshalled'
                ? decode(message.result.data)
                : message.result.data
        }
    }

    private static decode_error(message: ErrorMessage): ErrorCommand {
        return { ...message }
    }

    private static decode_dispose(message: DisposeMessage): DisposeCommand {
        return { ...message }
    }

    private static decode_disposed(message: DisposedMessage): DisposedCommand {
        return { ...message }
    }

    private static decode_terminate(message: TerminateMessage): TerminateCommand {
        return { ...message }
    }

    public static decode(message: Message): Command {
        switch (message.kind) {
            case 'construct': return this.decode_construct(message)
            case 'execute': return this.decode_execute(message)
            case 'result': return this.decode_result(message)
            case 'error': return this.decode_error(message)
            case 'dispose': return this.decode_dispose(message)
            case 'disposed': return this.decode_disposed(message)
            case 'terminate': return this.decode_terminate(message)
            default: throw Error('decode: Invalid message kind')
        }
    }

    // #endregion
}
