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

import { MarshalRegistry } from '../marshal/index'

/** A Mutex lock handle. */
export class MutexLock {
    constructor(private readonly __lock: Int32Array) {}

    /** Releases this lock and frees a critical section. */
    public dispose() {
        this.__lock[0] = 0
        Atomics.notify(this.__lock, 0, 1)
    }
}

/**
 * A mutual exclusion primitive. Instances of this type
 * can be shared between threads and used to lock critical
 * sections.
 * 
 * ```typescript
 * const mutex = new Mutex()
 * 
 * const lock = mutex.lock()
 * 
 * // critical section
 * 
 * lock.dispose()
 * ```
 */
export class Mutex {
    public readonly __lock = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT))
    
    /** 
     * Acquires a lock. This function will block the JavaScript
     * thread an wait for the lock to become available. This
     * function returns a `MutexLock` which the caller will
     * manually need to dispose().
     */
    public lock(): MutexLock {
        Atomics.wait(this.__lock, 0, 1)
        this.__lock[0] = 1
        return new MutexLock(this.__lock)
    }
}

// Register Mutex as Marshalled
MarshalRegistry.registerConstructor(Mutex)

