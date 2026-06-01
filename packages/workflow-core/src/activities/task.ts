export async function getTranscodeWorkerQueueActivity(): Promise<string> {
  return 'transcode_queue'
}

export async function getAgentWorkerQueueActivity(): Promise<string> {
  return 'agent_queue'
}
