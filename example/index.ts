import { Thread, Sender, Receiver } from '@sinclair/threadbox'
import { equal } from 'assert'

const WorkerC = Thread.Constructor(class {
    run(x: number) {
        return x
    }
})

const WorkerB = Thread.Constructor(class {
    async run(sender: Sender, iterations: number, values: number[]) {
        const c_0 = Thread.Spawn(WorkerC)
        const c_1 = Thread.Spawn(WorkerC)
        const c_2 = Thread.Spawn(WorkerC)
        const c_3 = Thread.Spawn(WorkerC)
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
})

const WorkerA = Thread.Constructor(class {
    async run(receiver: Receiver) {
        let acc = 0
        for await(const [a, b, c, d] of receiver) {
            acc += (a + b + c + d) // acc + 10
            console.log('A', a, b, c, d, acc)
        }
        return acc
    }
})

Thread.Main(async () => {
    
    const [sender, receiver] = Thread.Channel()
    const a = Thread.Spawn(WorkerA)
    const b = Thread.Spawn(WorkerB)

    const [_, result] = await Promise.all([
        b.run(sender, 10, [1, 2, 3, 4]),
        a.run(receiver)
    ])

    await a.dispose()
    await b.dispose()

    console.log('M', result)
    equal(result, 100)
    
})