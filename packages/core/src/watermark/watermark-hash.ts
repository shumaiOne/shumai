import type { WatermarkConfigSpec } from '@shumai/dtos'

export function computeWatermarkConfigHash(config: WatermarkConfigSpec): string {
  const blockStrings = config.blocks.map((block) => {
    if (block.type === 'text') {
      return `text|x:${block.x.toFixed(4)}|y:${block.y.toFixed(4)}|op:${block.opacity.toFixed(2)}|rot:${block.rotation.toFixed(2)}|sz:${block.size.toFixed(4)}|col:${block.color.toLowerCase()}|txt:${block.text}`
    } else {
      return `image|x:${block.x.toFixed(4)}|y:${block.y.toFixed(4)}|op:${block.opacity.toFixed(2)}|rot:${block.rotation.toFixed(2)}|sz:${block.size.toFixed(4)}|img:${block.imageAssetId}`
    }
  })
  blockStrings.sort()
  const str = blockStrings.join(';')
  return Bun.hash(str).toString(16)
}
