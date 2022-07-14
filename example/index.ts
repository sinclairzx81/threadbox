import { Thread } from '@sinclair/threadbox'

const Worker = Thread.Worker(class {
    public echo(message: string) {
        return message
    }
})

Thread.Main(async () => { 
   
    const worker = Thread.Spawn(Worker)

    const message = await worker.echo('hello world')
    
    console.log(message)

    worker.dispose()
})
