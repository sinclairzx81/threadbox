import { spawn, Main, Thread, channel, Sender, Receiver } from '@sinclair/threadbox'
import { equal } from 'assert'

@Thread() class WorkerC {
    run(x: number) {
        return x
    }
}
@Thread() class WorkerB {
    async run(sender: Sender, iterations: number, values: number[]) {
        const c_0 = spawn(WorkerC)
        const c_1 = spawn(WorkerC)
        const c_2 = spawn(WorkerC)
        const c_3 = spawn(WorkerC)
        for(let i = 0; i < iterations; i++) {
            const [a, b, c, d] = await Promise.all([
                c_0.run(values[0]),
                c_1.run(values[1]),
                c_2.run(values[2]),
                c_3.run(values[3]),
            ])
            await sender.send([a, b, c, d])
        }
        await sender.end()
        await c_0.dispose()
        await c_1.dispose()
        await c_2.dispose()
        await c_3.dispose()
    }
}
@Thread() class WorkerA {
    async run(receiver: Receiver) {
        let acc = 0
        for await(const [a, b, c, d] of receiver) {
            acc += (a + b + c + d) // acc + 10
            console.log('A', a, b, c, d, acc)
        }
        return acc
    }
}
// start here ...
@Main() default class {
    async main() {
        const [sender, receiver] = channel()
        const a = spawn(WorkerA)
        const b = spawn(WorkerB)

        const [_, result] = await Promise.all([
            b.run(sender, 10, [1, 2, 3, 4]),
            a.run(receiver)
        ])

        await a.dispose()
        await b.dispose()

        console.log('M', result)
        equal(result, 100)
    }
}