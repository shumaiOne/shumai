/**
 * | output |
 * | --- |
 * | "Join our community of developers and designers." |
 *
 * @param {Auth_Community_CtaInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const auth_community_cta: ((
  inputs?: Auth_Community_CtaInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Auth_Community_CtaInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Auth_Community_CtaInputs = {}
