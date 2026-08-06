import type { WatermarkConfigSpec } from '@shumai/dtos'

export interface RenderBlockImageData {
  imageAssetId: string
  base64Data: string
  mimeType: string
  width: number
  height: number
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateWatermarkSvg(
  config: WatermarkConfigSpec,
  canvasWidth: number,
  canvasHeight: number,
  blockImagesMap: Map<string, RenderBlockImageData> = new Map(),
): string {
  const elements: string[] = []

  for (const block of config.blocks) {
    const cx = canvasWidth * block.x
    const cy = canvasHeight * block.y
    const opacity = Math.max(0, Math.min(1, block.opacity))
    const rotation = block.rotation || 0

    if (block.type === 'text') {
      const fontSize = Math.max(1, Math.round(canvasWidth * block.size))
      const textContent = escapeXml(block.text || '')
      const fill = escapeXml(block.color || '#FFFFFF')

      elements.push(
        `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fill}" opacity="${opacity}" transform="rotate(${rotation}, ${cx}, ${cy})">${textContent}</text>`,
      )
    } else if (block.type === 'image') {
      const imageData = blockImagesMap.get(block.imageAssetId)
      if (!imageData) continue

      const targetWidth = Math.max(1, Math.round(canvasWidth * block.size))
      const aspectRatio = imageData.height > 0 ? imageData.width / imageData.height : 1
      const targetHeight = Math.max(1, Math.round(targetWidth / aspectRatio))

      const x = cx - targetWidth / 2
      const y = cy - targetHeight / 2

      elements.push(
        `<image x="${x}" y="${y}" width="${targetWidth}" height="${targetHeight}" href="data:${imageData.mimeType};base64,${imageData.base64Data}" opacity="${opacity}" transform="rotate(${rotation}, ${cx}, ${cy})"/>`,
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">${elements.join(
    '\n',
  )}</svg>`
}
