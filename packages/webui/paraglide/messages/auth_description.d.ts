/**
 * | output |
 * | --- |
 * | "Upload and index your files, enrich them with custom metadata schemas, draw annotations directly on media, and gather instant feedback — all in one modern wo..." |
 *
 * @param {Auth_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const auth_description: ((
  inputs?: Auth_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Auth_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Auth_DescriptionInputs = {}
