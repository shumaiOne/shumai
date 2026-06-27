/**
 * | output |
 * | --- |
 * | "Project Settings" |
 *
 * @param {Project_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_settings: ((
  inputs?: Project_SettingsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Project_SettingsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Project_SettingsInputs = {}
