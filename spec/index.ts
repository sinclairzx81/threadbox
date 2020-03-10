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