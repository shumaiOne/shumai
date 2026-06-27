/**
 * | output |
 * | --- |
 * | "Base URL (Optional)" |
 *
 * @param {Base_Url_OptionalInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const base_url_optional: ((
  inputs?: Base_Url_OptionalInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Base_Url_OptionalInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Base_Url_OptionalInputs = {}
