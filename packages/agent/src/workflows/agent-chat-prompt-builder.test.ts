import { describe, it, expect } from 'vitest'
import {
  AgentChatPromptBuilder,
  PROMPT_ASSET_BASE,
  PROMPT_PATH_CONTEXT,
  PROMPT_MEDIA_INFO,
  PROMPT_MEDIA_TOOL_INSTRUCTION,
  PROMPT_EXPLICIT_MENTION,
  PROMPT_IMPLICIT_MENTION,
} from './agent-chat-prompt-builder'

describe('AgentChatPromptBuilder', () => {
  it('should build prompt with baseline configurations (implicit mention)', () => {
    const builder = new AgentChatPromptBuilder('a1')
    const result = builder.build()

    const expected =
      PROMPT_ASSET_BASE('a1') + PROMPT_MEDIA_TOOL_INSTRUCTION + PROMPT_IMPLICIT_MENTION

    expect(result).toBe(expected)
  })

  it('should build prompt with explicit mention', () => {
    const builder = new AgentChatPromptBuilder('a1').withExplicitMention(true)
    const result = builder.build()

    const expected =
      PROMPT_ASSET_BASE('a1') + PROMPT_MEDIA_TOOL_INSTRUCTION + PROMPT_EXPLICIT_MENTION

    expect(result).toBe(expected)
  })

  it('should build prompt with path context', () => {
    const builder = new AgentChatPromptBuilder('a1').withPathContext('folder/sub/file.png')
    const result = builder.build()

    const expected =
      PROMPT_ASSET_BASE('a1') +
      PROMPT_PATH_CONTEXT('folder/sub/file.png') +
      PROMPT_MEDIA_TOOL_INSTRUCTION +
      PROMPT_IMPLICIT_MENTION

    expect(result).toBe(expected)
  })

  it('should build prompt with media info', () => {
    const media = { duration: 10, format: 'mp4' }
    const builder = new AgentChatPromptBuilder('a1').withMediaInfo(media)
    const result = builder.build()

    const expected =
      PROMPT_ASSET_BASE('a1') +
      PROMPT_MEDIA_INFO(JSON.stringify(media, null, 2)) +
      PROMPT_MEDIA_TOOL_INSTRUCTION +
      PROMPT_IMPLICIT_MENTION

    expect(result).toBe(expected)
  })

  it('should build prompt with all fields combined', () => {
    const media = { width: 1920, height: 1080 }
    const builder = new AgentChatPromptBuilder('a1')
      .withExplicitMention(true)
      .withPathContext('src/main.ts')
      .withMediaInfo(media)
    const result = builder.build()

    const expected =
      PROMPT_ASSET_BASE('a1') +
      PROMPT_PATH_CONTEXT('src/main.ts') +
      PROMPT_MEDIA_INFO(JSON.stringify(media, null, 2)) +
      PROMPT_MEDIA_TOOL_INSTRUCTION +
      PROMPT_EXPLICIT_MENTION

    expect(result).toBe(expected)
  })
})
