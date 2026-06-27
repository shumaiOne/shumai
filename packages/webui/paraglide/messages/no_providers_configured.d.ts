/**
 * | output |
 * | --- |
 * | "No Providers Configured" |
 *
 * @param {No_Providers_ConfiguredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_providers_configured: ((
  inputs?: No_Providers_ConfiguredInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Providers_ConfiguredInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Providers_ConfiguredInputs = {}
