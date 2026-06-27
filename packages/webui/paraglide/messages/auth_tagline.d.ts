/**
 * | output |
 * | --- |
 * | "One workspace for all your creative assets." |
 *
 * @param {Auth_TaglineInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const auth_tagline: ((
  inputs?: Auth_TaglineInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Auth_TaglineInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Auth_TaglineInputs = {}
