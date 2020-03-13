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

import { channel, Sender, Receiver } from './channel'

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<T1, T2, T3, T4, T5, T6, T7, T8>(
    r1: Receiver<T1>,
    r2: Receiver<T2>,
    r3: Receiver<T3>,
    r4: Receiver<T4>,
    r5: Receiver<T5>,
    r6: Receiver<T6>,
    r7: Receiver<T7>,
    r8: Receiver<T8>
): Receiver<T1 | T2 | T3 | T4 | T5 | T6 | T7>

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<T1, T2, T3, T4, T5, T6, T7>(
    r1: Receiver<T1>,
    r2: Receiver<T2>,
    r3: Receiver<T3>,
    r4: Receiver<T4>,
    r5: Receiver<T5>,
    r6: Receiver<T6>,
    r7: Receiver<T7>
): Receiver<T1 | T2 | T3 | T4 | T5 | T6 | T7>

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<T1, T2, T3, T4, T5, T6>(
    r1: Receiver<T1>,
    r2: Receiver<T2>,
    r3: Receiver<T3>,
    r4: Receiver<T4>,
    r5: Receiver<T5>,
    r6: Receiver<T6>
): Receiver<T1 | T2 | T3 | T4 | T5 | T6>

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<T1, T2, T3, T4, T5>(
    r1: Receiver<T1>,
    r2: Receiver<T2>,
    r3: Receiver<T3>,
    r4: Receiver<T4>,
    r5: Receiver<T5>
): Receiver<T1 | T2 | T3 | T4 | T5>

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<T1, T2, T3, T4>(
    r1: Receiver<T1>,
    r2: Receiver<T2>,
    r3: Receiver<T3>,
    r4: Receiver<T4>
): Receiver<T1 | T2 | T3 | T4>

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<T1, T2, T3>(
    r1: Receiver<T1>,
    r2: Receiver<T2>,
    r3: Receiver<T3>
): Receiver<T1 | T2 | T3>

/**
 * Selects from the given Receiver<T> types and produces a multiplexed
 * Receiver<T> combining elements for each.
 */
export function select<T1, T2>(
    r1: Receiver<T1>,
    r2: Receiver<T2>
): Receiver<T1 | T2>

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<T1>(r1: Receiver<T1>): Receiver<T1>

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select(...sources: Array<Receiver<any>>): Receiver<any> {
    async function receive(sender: Sender<any>, receiver: Receiver<any>) {
        for await(const value of receiver) {
            await sender.send(value)
        }
        await sender.end()
    }
    const [sender, receiver] = channel<any>()
    const promises = sources.map(source => receive(sender, source))
    Promise.all(promises).then(() => sender.end())
    return receiver
}
