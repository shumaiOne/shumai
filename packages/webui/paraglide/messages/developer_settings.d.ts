/**
 * | output |
 * | --- |
 * | "Developer Settings" |
 *
 * @param {Developer_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const developer_settings: ((
  inputs?: Developer_SettingsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Developer_SettingsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Developer_SettingsInputs = {}
