/**
 * | output |
 * | --- |
 * | "Configured AI Providers" |
 *
 * @param {Configured_Ai_ProvidersInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const configured_ai_providers: ((
  inputs?: Configured_Ai_ProvidersInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Configured_Ai_ProvidersInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Configured_Ai_ProvidersInputs = {}
