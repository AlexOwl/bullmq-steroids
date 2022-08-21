export function assignSteroidData(node, data) {
    node.data = {
        ...(node.data || []),
        steroid: {
            ...(node.data?.steroid || {}),
            ...data
        }
    }
}

export function getMinimalJob({ name, queueName, opts: { jobId } = {}, prefix }) {
    return { name, prefix, queueName, jobId }
}
