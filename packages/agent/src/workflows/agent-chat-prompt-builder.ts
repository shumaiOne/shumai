export function getSimpleMediaType(proxyType?: string | null): 'image' | 'video' | 'pdf' | 'other' {
  if (proxyType === 'image') return 'image'
  if (proxyType === 'video') return 'video'
  if (proxyType === 'pdf') return 'pdf'
  return 'other'
}

export class AgentChatPromptBuilder {
  private assetId: string
  private assetName?: string
  private mediaType?: string
  private proxyType?: string
  private videoDuration?: number
  private totalPages?: number
  private commentTimestamp?: number
  private pathContext?: string
  private attachedFiles: string[] = []
  private referencedAssets: string[] = []
  private userInfo?: { name: string; role: string }

  private isContinuation = false
  private hasAssetChanged = false

  constructor(assetId: string) {
    this.assetId = assetId
  }

  withUserInfo(name?: string, role?: string): this {
    if (name) {
      this.userInfo = { name, role: role || 'user' }
    }
    return this
  }

  withContinuation(isContinuation: boolean): this {
    this.isContinuation = isContinuation
    return this
  }

  withAssetChanged(hasAssetChanged?: boolean): this {
    this.hasAssetChanged = !!hasAssetChanged
    return this
  }

  withAttachedFiles(files?: string[]): this {
    if (files) {
      this.attachedFiles = files
    }
    return this
  }

  withReferencedAssets(assets?: string[]): this {
    if (assets) {
      this.referencedAssets = assets
    }
    return this
  }

  withPathContext(pathContext?: string): this {
    this.pathContext = pathContext
    return this
  }

  withAssetDetails(
    name: string,
    mediaType: string | null,
    duration?: number,
    totalPages?: number,
    proxyType?: string | null,
  ): this {
    this.assetName = name
    this.mediaType = mediaType || undefined
    this.proxyType = proxyType || undefined
    this.videoDuration = duration
    this.totalPages = totalPages
    return this
  }

  withCommentTimestamp(second?: number | null): this {
    if (second !== undefined && second !== null) {
      this.commentTimestamp = second
    }
    return this
  }

  build(): string {
    const effectiveType = this.proxyType

    if (this.isContinuation) {
      let instruction = ''
      if (this.hasAssetChanged) {
        instruction += `[Context: User Navigated to a New Location]\nNew Location Asset ID: ${this.assetId}`
        if (this.assetName) {
          instruction += `\nFile Name: ${this.assetName}`
        }
        if (effectiveType) {
          const type = getSimpleMediaType(effectiveType)
          instruction += `\nFile Type: ${type}`
          if (type === 'video' && this.videoDuration !== undefined) {
            instruction += `\nVideo Length: ${this.videoDuration.toFixed(2)} seconds`
          } else if (type === 'pdf' && this.totalPages !== undefined) {
            instruction += `\nTotal Pages: ${this.totalPages}`
          }
        }
        if (this.pathContext) {
          instruction += `\n\nAsset Path Context:\n${this.pathContext}`
        }
      }
      if (this.commentTimestamp !== undefined) {
        const type = getSimpleMediaType(effectiveType)
        if (instruction) instruction += '\n\n'
        if (type === 'pdf') {
          instruction += `Comment Page: ${Math.round(this.commentTimestamp)}`
        } else {
          instruction += `Comment Timestamp: ${this.commentTimestamp.toFixed(2)} seconds`
        }
      }
      if (this.attachedFiles.length > 0 || this.referencedAssets.length > 0) {
        if (instruction) instruction += '\n\n'
        instruction += `[Context: New Attached Files & Referenced Assets]`
        if (this.attachedFiles.length > 0) {
          instruction += `\nAttached Files:\n${this.attachedFiles.join('\n')}`
        }
        if (this.referencedAssets.length > 0) {
          instruction += `\nReferenced Workspace Assets:\n${this.referencedAssets.join('\n')}`
        }
      }
      return instruction.trim()
    }

    let instruction = `The user is discussing an asset with ID: ${this.assetId}.`
    if (this.assetName) {
      instruction += `\nFile Name: ${this.assetName}`
    }
    if (effectiveType) {
      const type = getSimpleMediaType(effectiveType)
      instruction += `\nFile Type: ${type}`
      if (type === 'video' && this.videoDuration !== undefined) {
        instruction += `\nVideo Length: ${this.videoDuration.toFixed(2)} seconds`
      } else if (type === 'pdf' && this.totalPages !== undefined) {
        instruction += `\nTotal Pages: ${this.totalPages}`
      }
    }
    if (this.commentTimestamp !== undefined) {
      const type = getSimpleMediaType(effectiveType)
      if (type === 'pdf') {
        instruction += `\nComment Page: ${Math.round(this.commentTimestamp)}`
      } else {
        instruction += `\nComment Timestamp: ${this.commentTimestamp.toFixed(2)} seconds`
      }
    }
    if (this.pathContext) {
      instruction += `\n\nAsset Path Context:\n${this.pathContext}`
    }

    if (this.attachedFiles.length > 0 || this.referencedAssets.length > 0) {
      instruction += `\n\n[Context: Attached Files & Referenced Assets]`
      if (this.attachedFiles.length > 0) {
        instruction += `\nAttached Files:\n${this.attachedFiles.join('\n')}`
      }
      if (this.referencedAssets.length > 0) {
        instruction += `\nReferenced Workspace Assets:\n${this.referencedAssets.join('\n')}`
      }
    }

    if (effectiveType) {
      const type = getSimpleMediaType(effectiveType)
      if (type === 'image') {
        instruction += `\n\nIf you need to view the image data, call the 'analyze_image' tool. It does not require any parameters.`
      } else if (type === 'video') {
        instruction += `\n\nIf you need to view visual frames or take screenshots of the video, call the 'screenshot' tool. You must specify the 'start' (seconds), 'end' (seconds), and 'count' (number of screenshots) parameters.`
      } else if (type === 'pdf') {
        instruction += `\n\nIf you need to view pages of the PDF document, call the 'read_pdf_pages' tool. You must specify the 'start' (page number) and 'end' (page number) parameters. Maximum 20 pages allowed per call.`
      }
    }

    if (this.userInfo) {
      instruction += `\n\nUser Info:\nName: ${this.userInfo.name}\nRole: ${this.userInfo.role}`
    }

    return instruction
  }
}
