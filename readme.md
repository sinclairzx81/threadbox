<div align='center'>

<h1>ThreadBox</h1>

<p>Recursive Multi-Threaded Worker Processes in NodeJS</p>

[![npm version](https://badge.fury.io/js/%40sinclair%2Fthreadbox.svg)](https://badge.fury.io/js/%40sinclair%2Fthreadbox)
[![Build Status](https://travis-ci.org/sinclairzx81/threadbox.svg?branch=master)](https://travis-ci.org/sinclairzx81/threadbox)

<img src='https://raw.githubusercontent.com/sinclairzx81/threadbox/master/doc/threadbox.png'></img>

</div>

## Example

The following code replicates the above worker topology. See [here](./doc/example.js) for non-decorator implementation.

```typescript
import { spawn, Main, Thread, channel, Sender, Receiver } from '@sinclair/threadbox'

@Thread() class WorkerC {
    run() {
        return Math.random()
    }
}
@Thread() class WorkerB {
    async run(sender: Sender) {
        const c_0 = spawn(WorkerC)
        const c_1 = spawn(WorkerC)
        const c_2 = spawn(WorkerC)
        const c_3 = spawn(WorkerC)
        const [a, b, c, d] = await Promise.all([
            c_0.run(),
            c_1.run(),
            c_2.run(),
            c_3.run(),
        ])
        await sender.send([a, b, c, d])
        await sender.end()
        await c_0.dispose()
        await c_1.dispose()
        await c_2.dispose()
        await c_3.dispose()
    }
}
@Thread() class WorkerA {
    async run(receiver: Receiver) {
        for await(const [a, b, c, d] of receiver) { }
    }
}
// start here ...
@Main() default class {
    async main() {
        const [sender, receiver] = channel()
        const a = spawn(WorkerA)
        const b = spawn(WorkerB)
        await Promise.all([
            a.run(receiver),
            b.run(sender) 
        ])
        await a.dispose()
        await b.dispose()
    }
}
```

<a name="Overview"></a>

## Overview

ThreadBox is a threading library for JavaScript that is built on top of the NodeJS `worker_threads` API. It is written to allow for compute intensive JavaScript and WASM processes to be trivially parallalized and distributed across many threads.

ThreadBox works by using process recursion to spawn new worker threads. When spawning a thread, ThreadBox will start it using the current threads entry module (typically `app.js`). Internally it provides switching logic within the new thread to instance one of the denoted `@Thread` classes. Because each new thread is started from the same entry module as the host thread; `class`, `function` and `const` definitions defined in the host are available to each subsequent thread. This pattern allows for ergonomic same file threading seen in other languages and is generally more intuitive than spreading logic across multiple `.js` files.

ThreadBox was built as a research project and is primarily geared towards TypeScript development. It does however provide a non-decorator based fallback API for JavaScript users. This library is offered as is to anyone who may find it of use.

Built with Node 12.16.1 LTS and TypeScript 3.8.3.

Licence MIT

<a name="Install"></a>

## Install

```bash
$ npm install @sinclair/threadbox --save
```

## Contents
- [Install](#Install)
- [Overview](#Overview)
- [Main](#Main)
- [Thread](#Thread)
- [Spawn](#Spawn)
- [Channel](#Channel)
- [Marshal](#Marshal)
- [Mutex](#Mutex)
- [SharedArrayBuffer](#SharedArrayBuffer)

<a name="Main"></a>

## Main

A decorator that denotes a class as the program entry point. The classes `main(...)` function will be called when the program is run. There can only be one `@Main()` entry point defined within the program.

```typescript

import { Main } from '@sinclair/threadbox'

@Main() class Program {
    main(argv: string[]) {
        console.log('hello world')
    }
}

// JavaScript users can use __Main(Program) if
// decorators are not available.
```

<a name="Thread"></a>

## Thread

Denotes a class as threadable which allows it to instanced with `spawn()`. Any class may be denoted as a `@Thread()`. When spawned, the parent thread will be able to execute all the functions of the class instance (see `spawn()` section for details). The classes `constructor` will be called when the worker is created and the `dispose()` method will be called when the parent thread has chosen to `dispose()` of the worker.

```typescript
import { Thread } from '@sinclair/threadbox'

@Thread() class Worker {
    constructor() {
        console.log('worker started')
    }
    add(a: number, b: number) {
        return a + b
    }
    subtract(a: number, b: number) {
        return a - b
    }
    dispose() {
        console.log('worker disposed')
    }
}
// JavaScript users can use __Thread(Worker) if
// decorators are not available.
```

<a name="Spawn"></a>

## Spawn

Will spawn a class marked as `@Thread`. This function returns a proxy to the class which can be used to invoke the classes methods.

```typescript
import { spawn, Main, Worker } from '@sinclair/threadbox'

@Thread() class Worker {
    constructor() {
        console.log('worker: constructor')
    }
    method() {
        console.log('worker: method')
    }
    dispose() {
        console.log('worker: dispose')
    }
}
@Main() class Program {
    async main() {
        const worker = spawn(Worker)
        await worker.method()
        await worker.dispose()
    }
}
```
The return type of `spawn()` is a `WorkerInterface<T>`. This interface is promise based and provides access to all of the classes methods and an additional `dispose()` that will terminate the worker. Workers can optionally implement `dispose()` to free any resources taken by the thread.

<a name="Channel"></a>

## Channel

ThreadBox provides a channel abstraction over the `MessageChannel` and `MessagePort` API. These channels implement a synchronization protocol that enables message senders to optionally `await` for messages to be received by a `Receiver`. ThreadBox channels are loosely modelled on Rust mpsc [channels](https://doc.rust-lang.org/std/sync/mpsc/fn.channel.html). 

```typescript
import { channel } from '@sinclair/threadbox'

const [sender, receiver] = channel()
```

The channel `Sender` and `Receiver` types can be used to stream sequences of values between cooperating threads.

#### Example 1

The following code creates a channel inside the `Main` thread and sends the `Sender` to the `Worker` thread. The worker will emit values to the `Sender` which are iterated within the `Main` thread.

```typescript
import { spawn, Main, Worker, channel, Sender, Receiver } from '@sinclair/threadbox'

@Thread() class Worker {
    async execute(sender: Sender<number>) {
        await sender.send(1)
        await sender.send(2)
        await sender.send(3)
        await sender.end()
    }
}

@Main() default class {
    main() {
        // spawn worker
        const worker = spawn(Worker)
        // create channel
        const [sender, receiver] = channel<number>()
        // pass sender to worker
        worker.execute(sender)
        // enumerate receiver
        for await(const value of receiver) {
            console.log('recv', value)
        }
        // dispose
        await worker.dispose()
    }
}
```

#### Example 2

The following code creates a channel inside the `Worker` thread and returns a `Receiver` on the `numbers()` function. The `Main` thread then spawns the `Worker` thread and calls `numbers()` and awaits for the `Receiver` which it then iterates. The `into()` function is a utility function to allow one to move into an `async` context.

```typescript
import { spawn, into, Main, Worker, channel, Sender, Receiver } from '@sinclair/threadbox'

@Thread() class Worker {
    numbers(): Receiver<number> {
        const [sender, receiver] = channel<number>()
        into(async() => {
            await sender.send(1)
            await sender.send(2)
            await sender.send(3)
            await sender.end()
        })
        return receiver
    }
}

@Main() default class {

    main() {
        // Spawn new Worker thread
        const worker = spawn(Worker)
        // call and wait for reciever
        const receiver = await worker.numbers()
        // enumerate receiver
        for await(const value of receiver) {
            console.log('recv', value)
        }
        // dispose
        await worker.dispose()
    }
}
```

<a name="Marshal"></a>

## Marshal

Denotes a class as being marshalled. This enables instances of classes to be sent and reconstructed across thread boundaries. If enabled, ThreadBox will automatically marshal instances of the class when pass as function arguments to a thread as well as over [channels](#Channel). 

This functionality allows class instances to be passed into threads for remote invocation. There is a serialization cost to marshalling however, use when appropriate.

```typescript

import { spawn, Main, Thread, Marshal } from '@sinclair/threadbox'

// Instances of this class can be sent between threads.
@Marshal() class Transferrable {
    method() {
        console.log('hello world !!!')
    }
}
@Thread() class Worker {
    // instance sent from host thread.
    execute(instance: Transferrable) {
        instance.method() // callable
    }
}
@Main() default class {
    async main() {
        // spawn worker
        const worker = spawn(Worker)
        // create instance
        const instance = new Transferrable()
        // send instance to worker to execute.
        await worker.execute(instance)
        // dispose.
        await worker.dispose()
    }
}

// JavaScript users can use __Marshal(Foo) if
// decorators are not available.
```

<a name="Mutex"></a>

## Mutex

ThreadBox provides a `Mutex` primitive that is built upon on JavaScript [Atomics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics). It is used to enter into critical sections of code.

```typescript
import { Mutex } from '@sinclair/threadbox'

const mutex = new Mutex()

const lock = mutex.lock()

// critical section

lock.dispose()
```

The example below spawns 4 instances of the `Worker` class. A `Mutex` instance is passed into each thread where by the worker takes a `MutexLock` on the `execute()` method. The worker thread holds onto their respective lock for 1 second before releasing. Only 1 of the 4 workers will execute the critical section commented below. The timeout is used to demonstrate the locking behavior.

```typescript
import { spawn, Main, Thread, Mutex } from '@sinclair/threadbox'

@Thread() class Worker {
    execute(mutex: Mutex) {
        const lock = mutex.lock()
        //
        // critical section !!
        //
        setTimeout(() => lock.dispose(), 1000)
    }
}
@Main() default class {
    async main() {
        const worker_0 = spawn(Worker)
        const worker_1 = spawn(Worker)
        const worker_2 = spawn(Worker)
        const worker_3 = spawn(Worker)

        const mutex  = new Mutex()
        await Promise.all([
            worker_0.execute(mutex),
            worker_1.execute(mutex),
            worker_2.execute(mutex),
            worker_3.execute(mutex)
        ]) // .. 4 seconds approx

        await worker_0.dispose()
        await worker_1.dispose()
        await worker_2.dispose()
        await worker_3.dispose()
    }
}
```

<a name="SharedArrayBuffer"></a>

## SharedArrayBuffer

The following demonstrates using `SharedArrayBuffer` to parallelize operations performed across a shared `Float32Array`. The shared buffer is sent to 4 workers with an index to store the result.

```typescript
import { spawn, Main, Worker } from '@sinclair/threadbox'

@Thread() class ComputeForIndex {
    execute(buffer: Float32Array, index: number) {
        // sleep 5 seconds
        const started = Date.now()
        while((Date.now() - started) < 5000) {}
        buffer[index] = Math.random()
    }
}

@Main() default class {
    async main() {
        // 4 x 32bit floats
        const shared = new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT)
        const buffer = new Float32Array(shared)

        // spin up 4 workers
        const c_0 = spawn(ComputeForIndex)
        const c_1 = spawn(ComputeForIndex)
        const c_2 = spawn(ComputeForIndex)
        const c_3 = spawn(ComputeForIndex)

        // process in parallel
        await Promise.all([
            c_0.execute(buffer, 0),
            c_1.execute(buffer, 1),
            c_2.execute(buffer, 2),
            c_3.execute(buffer, 3)
        ])

        // clean up
        await c_0.dispose()
        await c_1.dispose()
        await c_2.dispose()
        await c_3.dispose()

        // result
        console.log('result', buffer)
    }
}
```
