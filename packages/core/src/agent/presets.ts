import {
  PRESET_AVATAR_IDS,
  type PresetAvatarId,
  isPresetAvatarId,
  PRESET_AVATAR_BASE64,
} from '@shumai/dtos'

export { PRESET_AVATAR_IDS, type PresetAvatarId, isPresetAvatarId }

const bufferCache = new Map<PresetAvatarId, Buffer>()

export function getPresetAvatarBuffer(id: PresetAvatarId): Buffer | null {
  const cached = bufferCache.get(id)
  if (cached) return cached

  const b64 = PRESET_AVATAR_BASE64[id]
  if (!b64) return null

  const buf = Buffer.from(b64, 'base64')
  bufferCache.set(id, buf)
  return buf
}
