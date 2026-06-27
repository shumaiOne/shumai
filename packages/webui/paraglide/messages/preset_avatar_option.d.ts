/**
 * | output |
 * | --- |
 * | "Preset Avatar Option" |
 *
 * @param {Preset_Avatar_OptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const preset_avatar_option: ((
  inputs?: Preset_Avatar_OptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Preset_Avatar_OptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Preset_Avatar_OptionInputs = {}
