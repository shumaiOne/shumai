/**
 * | output |
 * | --- |
 * | "Allowed Domains" |
 *
 * @param {Allowed_DomainsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const allowed_domains: ((
  inputs?: Allowed_DomainsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Allowed_DomainsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Allowed_DomainsInputs = {}
