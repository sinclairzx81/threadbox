// JavaScript version of the ThreadBox readme example.

import { spawn, __Main, __Thread, channel } from '@sinclair/threadbox'

class WorkerC {
    run() {
        return Math.random()
    }
}; __Thread(WorkerC)

class WorkerB {
    async run(sender) {
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
}; __Thread(WorkerB)

class WorkerA {
    async run(receiver) {
        for await(const [a, b, c, d] of receiver) { }
    }
}; __Thread(WorkerA)

// start here ...
class Program {
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
}; __Main(Program)