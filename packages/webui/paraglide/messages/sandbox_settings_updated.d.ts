/**
 * | output |
 * | --- |
 * | "Sandbox settings updated" |
 *
 * @param {Sandbox_Settings_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sandbox_settings_updated: ((
  inputs?: Sandbox_Settings_UpdatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sandbox_Settings_UpdatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sandbox_Settings_UpdatedInputs = {}
