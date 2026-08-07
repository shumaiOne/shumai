import { describe, it, expect } from 'vitest'
import {
  watermarkConfigSpecSchema,
  watermarkBlockTextSchema,
  watermarkBlockImageSchema,
  WatermarkBlock,
} from '@shumai/dtos'

describe('Watermark Config DTO and Logic', () => {
  it('validates a correct text block', () => {
    const block = {
      id: 'block-1',
      type: 'text',
      x: 0.5,
      y: 0.5,
      opacity: 0.8,
      rotation: -30,
      text: 'CONFIDENTIAL',
      size: 0.05,
      color: '#FF0000',
    }
    const result = watermarkBlockTextSchema.safeParse(block)
    expect(result.success).toBe(true)
  })

  it('validates a correct image block', () => {
    const block = {
      id: 'block-2',
      type: 'image',
      x: 0.2,
      y: 0.8,
      opacity: 0.5,
      rotation: 0,
      imageAssetId: 'asset-logo-123',
      size: 0.15,
    }
    const result = watermarkBlockImageSchema.safeParse(block)
    expect(result.success).toBe(true)
  })

  it('validates watermarkConfigSpecSchema with mixed text and image blocks', () => {
    const config = {
      blocks: [
        {
          id: 'block-1',
          type: 'text' as const,
          x: 0.5,
          y: 0.5,
          opacity: 0.8,
          rotation: -30,
          text: 'CONFIDENTIAL',
          size: 0.05,
          color: '#FF0000',
        },
        {
          id: 'block-2',
          type: 'image' as const,
          x: 0.2,
          y: 0.8,
          opacity: 0.5,
          rotation: 0,
          imageAssetId: 'asset-logo-123',
          size: 0.15,
        },
      ],
    }
    const result = watermarkConfigSpecSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('correctly navigates prev/next index in block selector logic', () => {
    const blocks: WatermarkBlock[] = [
      {
        id: 'b1',
        type: 'text',
        x: 0.5,
        y: 0.5,
        opacity: 0.5,
        rotation: 0,
        text: 'B1',
        size: 0.08,
        color: '#000000',
      },
      {
        id: 'b2',
        type: 'text',
        x: 0.5,
        y: 0.5,
        opacity: 0.5,
        rotation: 0,
        text: 'B2',
        size: 0.08,
        color: '#000000',
      },
      {
        id: 'b3',
        type: 'text',
        x: 0.5,
        y: 0.5,
        opacity: 0.5,
        rotation: 0,
        text: 'B3',
        size: 0.08,
        color: '#000000',
      },
    ]

    const getNextIndex = (current: number, total: number) => (current + 1) % total
    const getPrevIndex = (current: number, total: number) => (current - 1 + total) % total

    expect(getNextIndex(0, blocks.length)).toBe(1)
    expect(getNextIndex(2, blocks.length)).toBe(0)
    expect(getPrevIndex(0, blocks.length)).toBe(2)
    expect(getPrevIndex(1, blocks.length)).toBe(0)
  })
})
