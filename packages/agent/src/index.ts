import { WorkflowTaskType } from '@shumai/db'
import { registerWorkflow } from '@shumai/workflow-core'
import { agentAutofillMedia } from './workflows/agent-autofill'
import { agentChat } from './workflows/agent-chat'
import { agentEmbeddingMedia } from './workflows/agent-embedding'

export function initAgentWorkflows() {
  registerWorkflow(WorkflowTaskType.ai_embedding, agentEmbeddingMedia)
  registerWorkflow(WorkflowTaskType.ai_metadata_autofill, agentAutofillMedia)
  registerWorkflow(WorkflowTaskType.chat, agentChat)
}

export * from './activities/agent'
export {
  deleteAssetEmbeddingsActivity,
  extractAiMetadataActivity,
  generateImageEmbeddingActivity,
  generateTextEmbeddingActivity,
  generateVideoChunkEmbeddingActivity,
  saveAssetEmbeddingsActivity,
  type ExistingAssetEmbeddingInfo,
  type ExtractAiMetadataParams,
  type GeneratedEmbedding,
  type GenerateTextEmbeddingParams,
} from './activities/ai'
export * from './context/serialize-context'
export * from './operation-tools'
export * from './runtime'
export * from './tools/generate-image'
export * from './tools/generate-video'
export * from './workflows/agent-autofill'
export * from './workflows/agent-chat'
export * from './workflows/agent-embedding'
