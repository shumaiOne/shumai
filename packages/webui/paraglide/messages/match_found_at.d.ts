/**
 * | output |
 * | --- |
 * | "Match found at" |
 *
 * @param {Match_Found_AtInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const match_found_at: ((
  inputs?: Match_Found_AtInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Match_Found_AtInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Match_Found_AtInputs = {}
