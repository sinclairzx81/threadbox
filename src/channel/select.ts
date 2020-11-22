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

type Inner<T extends Receiver<any>[]> = { 
    [K in keyof T]: T[K] extends Receiver<infer U> ? U : never
}[number]

/**
 * Selects from the given Receiver<T> types and produces a
 * new multiplexed Receiver<T> merging elements for each.
 */
export function select<R extends Receiver<any>[]>(receivers: [...R]): Receiver<Inner<R>> {
    async function receive(sender: Sender<any>, receiver: Receiver<any>) {
        for await(const value of receiver) {
            await sender.send(value)
        }
        await sender.end()
    }
    const [sender, receiver] = channel<any>()
    const promises = receivers.map(source => receive(sender, source))
    Promise.all(promises).then(() => sender.end())
    return receiver
}
