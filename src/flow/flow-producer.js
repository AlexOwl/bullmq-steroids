
import { FlowProducer } from "bullmq";
import { v4 } from "uuid"

import { JobSteroidPatcher } from "../job/patcher.js"
import { assignSteroidData, getMinimalJob } from "../utils.js"

/*

export interface FlowJobSteroid extends FlowJob {
    exitOnError?: boolean;
    concurrent?: boolean;

    opts?: Omit<JobsOptionsSteroid, 'parent' | 'repeat'>;
    children?: FlowJobSteroid[];
}

export interface AddNodeOptsStedoid extends AddNodeOpts {
    node: FlowJobSteroid;
}*/

export class FlowProducerSteroid extends FlowProducer {

    static jobSteroidPatcher = new JobSteroidPatcher()

    async add(flow/*: FlowJobSteroid*/, opts/*?: FlowOpts*/)/*: Promise<JobNode>*/ {
        const flowSteroid = flow

        opts.queuesOptions = { ...opts.queuesOptions, removeRoot: opts.removeRoot }

        return super.add(flowSteroid, opts)
    }

    /*protected */addNode({ multi, node, parent, queuesOpts }/*: AddNodeOptsStedoid*/)/*: JobNode*/ {
        if(node.concurrent === undefined) node.concurrent = true // default behavior
        
        node.opts = { jobId: v4(), ...node.opts }
        
        if(!node.concurrent) {
            if(node.children && node.children.length > 1) {
                /**
                 * { job: 1, children: [...] }   ->   {
                 * { job: 2, children: [...] }   ->     job: 3, 
                 * { job: 3, children: [...] }   ->     children: [..., { 
                 *                               ->       job: 2,
                 *                               ->       children: [..., {
                 *                               ->         job: 1,
                 *                               ->         children: [...]
                 *                               ->       }]
                 *                               ->     }]
                 *                               ->   }
                 */

                const origChildren = [...node.children] // not deep

                node.children = [origChildren.reduce((prev, child) => {
                    child.opts = { jobId: v4(), ...child.opts }

                    if(prev) child.children = [prev, ...(child.children || [])] // add as first child

                    assignSteroidData(child, {
                        prev: prev ? getMinimalJob(prev) : undefined,
                        parent: getMinimalJob(node)
                    })
                    
                    return child
                }, null)]

                assignSteroidData(node, {
                    children: [
                        ...(node.data?.steroid?.children || []), 
                        ...origChildren.map(getMinimalJob)
                    ]
                })
            }
        }

        if(queuesOpts?.removeRoot) {
            if(!queuesOpts?.root) queuesOpts = { ...queuesOpts, root: getMinimalJob(node) }

            assignSteroidData(node, {
                root: { ...queuesOpts.root, remove: true }
            })
        }

        return super.addNode({ multi, node, parent, queuesOpts })
    }

}
/**
 * 
 *  sync -> means its child of previous (result -> get from child) // add result to { { realParentId, childrenValues[jobId] = result, realParent), result }
 *  async -> workers must be more than 1
 *  
 *  before -> (if retry ? beforeRetry : beforeStart(beforeRepeat)) // mustBeChild of job
 *  
 *  exitOnError: true -> (if error, add child to parent that waits for completion of this job, if job removed -> remove root) removeWithParent: true?
 * 
 *  retryWithParent: true -> 
 *  repeatWithParent: true ->
 * 
 *  how to make parallel with same children ...? async in different property and add them children
 *  
 *  add on processing
 * 
 *  repeat and delay +! simulteniosly
 */