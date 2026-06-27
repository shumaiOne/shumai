/**
 * | output |
 * | --- |
 * | "Generate and manage API keys for developers and automated workflows." |
 *
 * @param {Developer_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const developer_description: ((
  inputs?: Developer_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Developer_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Developer_DescriptionInputs = {}
