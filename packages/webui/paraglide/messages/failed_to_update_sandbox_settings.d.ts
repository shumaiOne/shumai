/**
 * | output |
 * | --- |
 * | "Failed to update sandbox settings" |
 *
 * @param {Failed_To_Update_Sandbox_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_update_sandbox_settings: ((
  inputs?: Failed_To_Update_Sandbox_SettingsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_Update_Sandbox_SettingsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_Update_Sandbox_SettingsInputs = {}
