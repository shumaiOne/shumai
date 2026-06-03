export const PROMPT_ASSET_BASE = (assetId: string) =>
  `The user is discussing an asset with ID: ${assetId}.`

export const PROMPT_PATH_CONTEXT = (pathContext: string) =>
  `\n\nAsset Path Context:\n${pathContext}`

export const PROMPT_MEDIA_INFO = (mediaJson: string) => `\n\nAsset Media Info:\n${mediaJson}`

export const PROMPT_MEDIA_TOOL_INSTRUCTION = `\n\nIf you need to view the asset's media content (frames/images/video), call the 'analyze_asset_media' tool by passing the appropriate 'key' from the Asset Media Info above. Choose the most suitable format based on your capabilities and the user's request (e.g., use a poster or sprite for quick visual checks, or a transcode/raw file for detailed analysis).`

export const PROMPT_EXPLICIT_MENTION = `\n\nThe user explicitly mentioned you in their message. You MUST reply to this message.`

export const PROMPT_IMPLICIT_MENTION = `\n\nThe user did not explicitly mention you, but is replying in a thread where you are the participant. Let's decide if you should reply or not. If the user is not directly addressing you or doesn't need a response from you, you may choose to not reply. To choose not to reply, respond with exactly and only the text: __NO_REPLY__.`

export class AgentChatPromptBuilder {
  private assetId: string
  private pathContext?: string
  private mediaInfo?: unknown
  private explicitMention = false

  constructor(assetId: string) {
    this.assetId = assetId
  }

  withPathContext(pathContext?: string): this {
    this.pathContext = pathContext
    return this
  }

  withMediaInfo(mediaInfo?: unknown): this {
    this.mediaInfo = mediaInfo
    return this
  }

  withExplicitMention(explicitMention?: boolean): this {
    this.explicitMention = !!explicitMention
    return this
  }

  build(): string {
    let instruction = PROMPT_ASSET_BASE(this.assetId)
    if (this.pathContext) {
      instruction += PROMPT_PATH_CONTEXT(this.pathContext)
    }
    if (this.mediaInfo) {
      instruction += PROMPT_MEDIA_INFO(JSON.stringify(this.mediaInfo, null, 2))
    }
    instruction += PROMPT_MEDIA_TOOL_INSTRUCTION
    if (this.explicitMention) {
      instruction += PROMPT_EXPLICIT_MENTION
    } else {
      instruction += PROMPT_IMPLICIT_MENTION
    }
    return instruction
  }
}
