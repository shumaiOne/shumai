/**
 * | output |
 * | --- |
 * | "No models configured" |
 *
 * @param {No_Models_ConfiguredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_models_configured: ((
  inputs?: No_Models_ConfiguredInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Models_ConfiguredInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Models_ConfiguredInputs = {}
