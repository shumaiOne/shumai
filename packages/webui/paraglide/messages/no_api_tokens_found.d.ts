/**
 * | output |
 * | --- |
 * | "No API tokens found. Generate one above to get started." |
 *
 * @param {No_Api_Tokens_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_api_tokens_found: ((
  inputs?: No_Api_Tokens_FoundInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Api_Tokens_FoundInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Api_Tokens_FoundInputs = {}
