export function getSimpleMediaType(mediaType?: string): 'image' | 'video' | 'other' {
  if (!mediaType) return 'other'
  const lower = mediaType.toLowerCase()
  if (
    lower.startsWith('image/') ||
    lower === 'application/x-photoshop' ||
    lower === 'image/vnd.adobe.photoshop'
  ) {
    return 'image'
  }
  if (lower.startsWith('video/')) {
    return 'video'
  }
  return 'other'
}

export class AgentChatPromptBuilder {
  private assetId: string
  private assetName?: string
  private mediaType?: string
  private videoDuration?: number
  private commentTimestamp?: number
  private pathContext?: string
  private explicitMention = false

  constructor(assetId: string) {
    this.assetId = assetId
  }

  withPathContext(pathContext?: string): this {
    this.pathContext = pathContext
    return this
  }

  withAssetDetails(name: string, mediaType: string | null, duration?: number): this {
    this.assetName = name
    this.mediaType = mediaType || undefined
    this.videoDuration = duration
    return this
  }

  withCommentTimestamp(second?: number | null): this {
    if (second !== undefined && second !== null) {
      this.commentTimestamp = second
    }
    return this
  }

  withExplicitMention(explicitMention?: boolean): this {
    this.explicitMention = !!explicitMention
    return this
  }

  build(): string {
    let instruction = `The user is discussing an asset with ID: ${this.assetId}.`
    if (this.assetName) {
      instruction += `\nFile Name: ${this.assetName}`
    }
    if (this.mediaType) {
      const type = getSimpleMediaType(this.mediaType)
      instruction += `\nFile Type: ${type}`
      if (type === 'video' && this.videoDuration !== undefined) {
        instruction += `\nVideo Length: ${this.videoDuration.toFixed(2)} seconds`
      }
    }
    if (this.commentTimestamp !== undefined) {
      instruction += `\nComment Timestamp: ${this.commentTimestamp.toFixed(2)} seconds`
    }
    if (this.pathContext) {
      instruction += `\n\nAsset Path Context:\n${this.pathContext}`
    }

    if (this.mediaType) {
      const type = getSimpleMediaType(this.mediaType)
      if (type === 'image') {
        instruction += `\n\nIf you need to view the image data, call the 'analyze_image' tool. It does not require any parameters.`
      } else if (type === 'video') {
        instruction += `\n\nIf you need to view visual frames or take screenshots of the video, call the 'screenshot' tool. You must specify the 'start' (seconds), 'end' (seconds), and 'count' (number of screenshots) parameters.`
      }
    }

    if (this.explicitMention) {
      instruction += `\n\nThe user explicitly mentioned you in their message. You MUST reply to this message.`
    } else {
      instruction += `\n\nThe user did not explicitly mention you, but is replying in a thread where you are the participant. Let's decide if you should reply or not. If the user is not directly addressing you or doesn't need a response from you, you may choose to not reply. To choose not to reply, respond with exactly and only the text: __NO_REPLY__.`
    }

    return instruction
  }
}
