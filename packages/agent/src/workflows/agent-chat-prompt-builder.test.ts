import { describe, it, expect } from 'vitest'
import { AgentChatPromptBuilder } from './agent-chat-prompt-builder'

describe('AgentChatPromptBuilder', () => {
  it('should build prompt with baseline configurations', () => {
    const builder = new AgentChatPromptBuilder('a1')
    const result = builder.build()

    expect(result).toContain('The user is discussing an asset with ID: a1.')
  })

  it('should build prompt with path context', () => {
    const builder = new AgentChatPromptBuilder('a1').withPathContext('folder/sub/file.png')
    const result = builder.build()

    expect(result).toContain('Asset Path Context:\nfolder/sub/file.png')
  })

  it('should build prompt with image asset details', () => {
    const builder = new AgentChatPromptBuilder('a1').withAssetDetails(
      'test.png',
      'image/png',
      undefined,
      undefined,
      'image',
    )
    const result = builder.build()

    expect(result).toContain('File Name: test.png')
    expect(result).toContain('File Type: image')
    expect(result).toContain("call the 'analyze_image' tool")
    expect(result).not.toContain("call the 'screenshot' tool")
  })

  it('should build prompt with video asset details and duration', () => {
    const builder = new AgentChatPromptBuilder('a1').withAssetDetails(
      'movie.mp4',
      'video/mp4',
      12.34,
      undefined,
      'video',
    )
    const result = builder.build()

    expect(result).toContain('File Name: movie.mp4')
    expect(result).toContain('File Type: video')
    expect(result).toContain('Video Length: 12.34 seconds')
    expect(result).toContain("call the 'screenshot' tool")
    expect(result).not.toContain("call the 'analyze_image' tool")
  })

  it('should build prompt with PDF asset details and total pages', () => {
    const builder = new AgentChatPromptBuilder('a1').withAssetDetails(
      'doc.pdf',
      'application/pdf',
      undefined,
      15,
      'pdf',
    )
    const result = builder.build()

    expect(result).toContain('File Name: doc.pdf')
    expect(result).toContain('File Type: pdf')
    expect(result).toContain('Total Pages: 15')
    expect(result).toContain("call the 'read_pdf_pages' tool")
    expect(result).toContain('Maximum 20 pages allowed per call.')
    expect(result).not.toContain("call the 'screenshot' tool")
    expect(result).not.toContain("call the 'analyze_image' tool")
  })

  it('should build prompt with comment page for PDF asset', () => {
    const builder = new AgentChatPromptBuilder('a1')
      .withAssetDetails('doc.pdf', 'application/pdf', undefined, 10, 'pdf')
      .withCommentTimestamp(3)
    const result = builder.build()

    expect(result).toContain('Comment Page: 3')
  })

  it('should build prompt for PDF continuation mode with comment page', () => {
    const builder = new AgentChatPromptBuilder('a1')
      .withContinuation(true)
      .withAssetDetails('doc.pdf', 'application/pdf', undefined, 10, 'pdf')
      .withCommentTimestamp(4)
    const result = builder.build()

    expect(result).toContain('Comment Page: 4')
    expect(result).not.toContain('Comment Timestamp:')
  })

  it('should build prompt with comment timestamp', () => {
    const builder = new AgentChatPromptBuilder('a1').withCommentTimestamp(5.5)
    const result = builder.build()

    expect(result).toContain('Comment Timestamp: 5.50 seconds')
  })

  it('should build prompt with all fields combined', () => {
    const builder = new AgentChatPromptBuilder('a1')
      .withPathContext('src/main.ts')
      .withAssetDetails('movie.mp4', 'video/mp4', 12.34, undefined, 'video')
      .withCommentTimestamp(8.2)
    const result = builder.build()

    expect(result).toContain('The user is discussing an asset with ID: a1.')
    expect(result).toContain('File Name: movie.mp4')
    expect(result).toContain('File Type: video')
    expect(result).toContain('Video Length: 12.34 seconds')
    expect(result).toContain('Comment Timestamp: 8.20 seconds')
    expect(result).toContain('Asset Path Context:\nsrc/main.ts')
    expect(result).toContain("call the 'screenshot' tool")
  })

  it('should build prompt with attached files and referenced assets', () => {
    const builder = new AgentChatPromptBuilder('a1')
      .withAttachedFiles(['- file1.txt', '- file2.png'])
      .withReferencedAssets(['- folder1', '- file3.mp4'])
    const result = builder.build()

    expect(result).toContain('[Context: Attached Files & Referenced Assets]')
    expect(result).toContain('Attached Files:\n- file1.txt\n- file2.png')
    expect(result).toContain('Referenced Workspace Assets:\n- folder1\n- file3.mp4')
  })

  it('should build prompt for continuation mode returning only turn-specific modifications', () => {
    const builder = new AgentChatPromptBuilder('a1')
      .withContinuation(true)
      .withAssetDetails('movie.mp4', 'video/mp4', 12.34)
      .withPathContext('src/main.ts')
      .withCommentTimestamp(8.2)
      .withAttachedFiles(['- file1.txt'])
      .withReferencedAssets(['- folder1'])
    const result = builder.build()

    expect(result).not.toContain('The user is discussing an asset with ID:')
    expect(result).not.toContain('File Name: movie.mp4')
    expect(result).not.toContain('Asset Path Context:')
    expect(result).toContain('Comment Timestamp: 8.20 seconds')
    expect(result).toContain('[Context: New Attached Files & Referenced Assets]')
    expect(result).toContain('Attached Files:\n- file1.txt')
    expect(result).toContain('Referenced Workspace Assets:\n- folder1')
  })

  it('should include location change context block in continuation mode when asset has changed', () => {
    const builder = new AgentChatPromptBuilder('a2')
      .withContinuation(true)
      .withAssetChanged(true)
      .withAssetDetails('new-folder', 'folder', undefined, undefined, 'folder')
      .withPathContext('projects/my-proj/new-folder')
    const result = builder.build()

    expect(result).toContain('[Context: User Navigated to a New Location]')
    expect(result).toContain('New Location Asset ID: a2')
    expect(result).toContain('File Name: new-folder')
    expect(result).toContain('Asset Path Context:\nprojects/my-proj/new-folder')
  })

  it('should build prompt with user info when provided and not continuation', () => {
    const builder = new AgentChatPromptBuilder('a1').withUserInfo('Alice', 'owner')
    const result = builder.build()

    expect(result).toContain('User Info:\nName: Alice\nRole: owner')
  })

  it('should build prompt with download_asset tool instruction', () => {
    const builder = new AgentChatPromptBuilder('a1')
    const result = builder.build()

    expect(result).toContain("call the 'download_asset' tool with assetId.")
  })
})
