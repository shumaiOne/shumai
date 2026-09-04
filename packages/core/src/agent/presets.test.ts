import { describe, expect, it } from 'vitest'
import {
  getPresetAvatarBuffer,
  isPresetAvatarId,
  PRESET_AVATAR_IDS,
  type PresetAvatarId,
} from './presets'

describe('agent presets', () => {
  it('identifies preset avatar IDs correctly', () => {
    expect(PRESET_AVATAR_IDS).toHaveLength(8)
    for (const id of PRESET_AVATAR_IDS) {
      expect(isPresetAvatarId(id)).toBe(true)
    }
    expect(isPresetAvatarId('avatar-999')).toBe(false)
    expect(isPresetAvatarId('')).toBe(false)
    expect(isPresetAvatarId(null)).toBe(false)
    expect(isPresetAvatarId(undefined)).toBe(false)
  })

  it('returns valid buffer for all preset avatars', () => {
    for (const id of PRESET_AVATAR_IDS) {
      const buf = getPresetAvatarBuffer(id)
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf?.length).toBeGreaterThan(5000)
    }
    expect(getPresetAvatarBuffer('unknown' as PresetAvatarId)).toBeNull()
  })

  it('provides AVAILABLE_AVATARS with 8 previews via dtos', async () => {
    const { AVAILABLE_AVATARS } = await import('@shumai/dtos')
    expect(AVAILABLE_AVATARS).toHaveLength(8)
    for (const avatar of AVAILABLE_AVATARS) {
      expect(avatar.id).toMatch(/^avatar-[1-8]$/)
      expect(avatar.preview).toMatch(/^data:image\/webp;base64,/)
    }
  })
})
