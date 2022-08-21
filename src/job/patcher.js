import { FlowProducer, Job } from "bullmq";

// TODO: remove repeated key whith job

export class JobSteroidPatcher {
    constructor() {
        this.JobClass = Job
    }

    _JobClass = null

    get JobClass() {
        return this._JobClass
    }

    // patchJob
    set JobClass(JobClass) {
        const prevJob = this._JobClass

        if(JobClass === null) {
            if(prevJob !== null) {
                prevJob.prototype.remove = prevJob.prototype._superRemove
                delete prevJob.prototype._superRemove
                this._JobClass = null
            }
            return
        }

        if(JobClass === prevJob) return
        
        // this.JobClass = null // unpatch
        this._JobClass = JobClass

        JobClass.prototype._superRemove = JobClass.prototype.remove
        JobClass.prototype.remove = async function steroidRemove() {
            const job = this;
            const queue = job.queue;

            await queue.waitUntilReady();

            const root = job.data?.steroid?.root;
            if(root && root.remove) {
                // get all locks in subtree
                const flow = new FlowProducer({ connection: job.queue.connection })
                const keys = await flow.getFlow({
                    id: root.jobId,
                    prefix: root.prefix,
                    queueName: root.queueName,
                    depth: 10000,
                    maxChildren: 10000,
                }).then(async function removeLock({ job, children }) {
                    const childrenPromises = await Promise.all((children?.map(removeLock) || [])).then(arr => arr.flat())

                    const key = await job.isActive() ? `${job.prefix||"bull"}:${job.queueName}:${job.id}:lock` : null

                    return [key, ...await childrenPromises].filter(v => v)
                });
                            
                const client = await flow.client
                await client.del(keys).catch(() => {})

                const removed = await this.scripts.remove(root.jobId);
                await flow.close()

                if(removed) console.log("success remove root")
                if (!removed) throw new Error(`Could not remove job ${job.id} (root ${root.jobId})`);

                queue.emit("removed", job);
                return
            }

            return job._superRemove()
        }
    }
}