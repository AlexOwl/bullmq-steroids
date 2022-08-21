import { Queue, Worker, QueueScheduler } from "bullmq"
import { FlowProducerSteroid } from "./index.js"


const connection = { host: "localhost", port: 6379 }

const queueName = "test"

const queue = new Queue(queueName,  { connection})

const queueScheduler = new QueueScheduler(queueName, { connection });

const worker = new Worker(queueName, async (job) => {
    console.log(new Date(), job.name, { 
        // queueName: job.queueName,
        jobId: job.id,
        data: JSON.stringify(job.data, null, 2),
        childrenValues: await job.getChildrenValues(),
    })

    if(job.name == "child2") {
        await job.remove().catch(e => console.log(e))
    }

    return job.data?.data || job.data
}, { concurrency: 10, connection })

worker.on("error", e => {
    if(e.message.startsWith("Missing lock for job")) {
        // its ok if you are removing root
        return
    }
    console.error(e)
})

const flow = new FlowProducerSteroid({ connection })

flow.add({ 
    name: "root",
    queueName: "test",
    data: { value: Math.random() },
    children: [{
        name: "child1",
        queueName,
        data:  { value: Math.random() },
        concurrent: false,
        children: [{
            name: "child1sub1",
            queueName,
            data:  { value: Math.random() }
        }, {
            name: "child1sub2",
            queueName,
            data: { value: Math.random() },
            children: [{
                name: "child1sub2sub1",
                queueName,
                opts: {
                    delay: 5000
                },
                data: { value: Math.random() }
            }, {
                name: "child1sub2sub2",
                queueName,
                data: { value: Math.random() }
            }]
        }, {
            name: "child1sub3",
            queueName,
            data: { value: Math.random() }
        }]
    }, {
        name: "child2",
        queueName,
        opts: {
            delay: 1000
        },
        data: { value: Math.random() }
    }, {
        name: "child3",
        queueName,
        data: { value: Math.random() }
    }]
}, { removeRoot: true }).catch(e => console.error("flow.add", e))