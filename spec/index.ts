import { spawn, Main, Worker } from '@sinclair/threadbox'

@Worker() class WorkerA {
    run() {
        console.log('hello')
    }
}
@Worker() class WorkerC {
    run() {
        console.log('world')
    }
}
@Worker() class WorkerB {
    async run() {
        const c_0 = spawn(WorkerC)
        const c_1 = spawn(WorkerC)
        const c_2 = spawn(WorkerC)
        const c_3 = spawn(WorkerC)
        await Promise.all([
            c_0.run(),
            c_1.run(),
            c_2.run(),
            c_3.run(),
        ])
        await c_0.dispose()
        await c_1.dispose()
        await c_2.dispose()
        await c_3.dispose()
    }
}
@Main() default class {
    async main() {
        const a = spawn(WorkerA)
        const b = spawn(WorkerB)
        await Promise.all([
            a.run(),
            b.run() 
        ])
        await a.dispose()
        await b.dispose()
    }
}