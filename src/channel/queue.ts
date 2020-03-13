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

import { MarshalRegistry } from '../marshal/index'
import { Resolve, defer }  from './defer'

/** An asynchronous queue. Allows for awaiting on lazy values. */
export class Queue<T> {
    private readonly promises:  Promise<T>[] = []
    private readonly resolvers: Resolve<T>[] = []

    public dequeue(): Promise<T> {
        if(this.promises.length > 0) {
            const promise = this.promises.shift()!
            return promise
        } else {
            const [promise, resolver] = defer<T>()
            this.resolvers.push(resolver)
            return promise
        }
    }
    public enqueue(value: T) {
        if(this.resolvers.length > 0) {
            const resolver = this.resolvers.shift()!
            resolver(value)
        } else {
            const [promise, awaiter] = defer<T>()
            awaiter(value)
            this.promises.push(promise)
        }
    }
}

// Register as marshalled
MarshalRegistry.registerConstructor(Queue)