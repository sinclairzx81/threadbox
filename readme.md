<div align='center'>

<h1>ThreadBox</h1>

<p>Recursive Worker Threads in NodeJS</p>

[![npm version](https://badge.fury.io/js/%40sinclair%2Fthreadbox.svg)](https://badge.fury.io/js/%40sinclair%2Fthreadbox)
[![Build Status](https://travis-ci.org/sinclairzx81/threadbox.svg?branch=master)](https://travis-ci.org/sinclairzx81/threadbox)

<img src='./doc/threadbox.png'></img>

</div>

### Example

The following replicates the above worker graph.

```typescript
import { Thread, Sender, Receiver } from '@sinclair/threadbox'

const WorkerC = Thread.Constructor(class {
  run() {
    return Math.random()
  }
})

const WorkerB = Thread.Constructor(class {
  async run(sender: Sender) {
    const c_0 = Thread.Spawn(WorkerC)
    const c_1 = Thread.Spawn(WorkerC)
    const c_2 = Thread.Spawn(WorkerC)
    const c_3 = Thread.Spawn(WorkerC)
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
})
const WorkerA = Thread.Constructor(class {
  async run(receiver: Receiver) {
    for await(const [a, b, c, d] of receiver) { }
  }
})

// start here ...
Thread.Main(() => {
  const [sender, receiver] = Thread.Channel()
  const a = Thread.Spawn(WorkerA)
  const b = Thread.Spawn(WorkerB)
  await Promise.all([
    a.run(receiver),
    b.run(sender) 
  ])
  await a.dispose()
  await b.dispose()
})
```

<a name="Overview"></a>

## Overview

ThreadBox is a threading library for JavaScript built on top of NodeJS `worker_threads`. It is written to allow for compute intensive and potentially blocking JavaScript routines to be easily executed in remote worker threads. ThreadBox uses a recursive threading model, where spawned threads are created by re-running the applications entry module (typically `app.js`). This approach allows for ergonomic threading, but requires code executed in the global scope to be moved into functions and classes.

This project is written as a research project to explore the potential for recursive threading in Node. It is offered to anyone who may find it of use.

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
- [Constructor](#Constructor)
- [Marshal](#Marshal)
- [Spawn](#Spawn)
- [Channel](#Channel)
- [Mutex](#Mutex)

<a name="Main"></a>

## Main

Use `Thread.Main(...)` to define the application entry point. This function will only be called once when the process starts, and ignored for subsequent threads.

```typescript
import { Thread } from '@sinclair/threadbox'

Thread.Main(() => {
  
  console.log('Hello World')
  
})
```

<a name="Constructor"></a>

## Constructor

Use `Thread.Constructor(...)` to denote a class as threadable. This enables the class to be spawned via `Thread.Spawn(...)`. The return type of this function returns the inner constructor that can be instanced in the current thread.

```typescript
import { Thread } from '@sinclair/threadbox'

const Basic = Thread.Constructor(class {
    add(a: number, b: number) {
        return a + b
    }
    dispose() { 
        console.log('disposed!')
    }
})

Thread.Main(async () => {
    // instance as thread
    const thread = Thread.Spawn(Basic)
    console.log(await thread.add(10, 20))
    await thread.dispose()

    // instance as local
    const local = new Basic()
    console.log(local.add(10, 20))
})
```

<a name="Spawn"></a>

## Spawn

The `Thread.Spawn(...)` to spawn a new constructor in a remote worker thread. This function takes the threadable constructor as it's first argument followed by any parameters defined for the constructor.

```typescript
import { Thread } from '@sinclair/threadbox'

const Runner = Thread.Constructor(class {
  constructor(private taskName: string) {
    console.log(`Runner: ${taskName}`)
  }
  process() {
    console.log(`Runner: execute: ${taskName}`)
  }
  dispose() {
    console.log(`Runner: dispose ${taskName}`)
  }
})

Thread.Main(async () => {
  const runner = Thread.Spawn(Runner, 'Name of Runner')
  await runner.execute()
  await runner.dispose()
})
```

<a name="Channel"></a>

## Channel

Use `Thread.Channel<T>()` to create a messaging channel to communicate between threads.

```typescript
import { Thread, Sender, Receiver } from '@sinclair/threadbox'

const Numbers = Thread.Constructor(class {
  start(sender: Sender<number>) {
    for(let i = 0; i < 1024; i++) {
        sender.send(i)
    }
  }
})

Thread.Main(async () => {
  const thread = Thread.Spawn(Numbers)
  const [sender, receiver] = Thread.Channel<number>()
  thread.start(sender)
  
  // await values on receiver
  for await(const value of receiver) {
    console.log(value)
  }

  await thread.dispose()
})
```

<a name="Marshal"></a>

## Marshal

Use `Thread.Marshal(...)` to denote a constructor should be marshalled across threads. This enables class instances to be transferred to remote threads for remote invocation.

```typescript
import { Thread } from '@sinclair/threadbox'

const Transferrable = Thread.Marshal({
    method() {
        console.log('Hello World')
    }
})

const Worker = Thread.Constructor({
    execute(transferable: Transferrable) {
        transferable.method() // callable
    }
}

Thread.Main(() => {
  const thread = spawn(Worker)
  const transferable = new Transferrable()
  await thread.execute(transferable)
  await thread.dispose()
})
```
Note: There is a serialization cost to marshaling. For performance, only `Marshal` when you need to dynamically move logic in and out of threads.

<a name="Mutex"></a>

## Mutex

Use `Thread.Mutex(...)` to create a lock on critical sections. This should only be used when two threads reference the same SharedArrayBuffer.



```typescript
import { Thread, Mutex } from '@sinclair/threadbox'

const Worker = Thread.Constructor(class {
  constructor(private readaonly mutex: Mutex) {}

  execute(data: Uint8Array, value: number) {
    this.mutex.lock()
    data[0] = value
    data[1] = value
    data[2] = value
    data[3] = value
    this.mutex.unlock()
  }
})

Thread.Main(async () => {

  const mutex = Thread.Mutex()

  const threads = [
    Thread.Spawn(Worker, mutex),
    Thread.Spawn(Worker, mutex),
    Thread.Spawn(Worker, mutex),
    Thread.Spawn(Worker, mutex)
  ]

  const shared = new Uint8Array(new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT))

  await Promise.all([
    threads[0].execute(shared)
    threads[1].execute(shared)
    threads[2].execute(shared)
    threads[3].execute(shared)
  ])

  await Promise.all([
    threads[0].dispose()
    threads[1].dispose()
    threads[2].dispose()
    threads[3].dispose()
  ])
})
```
