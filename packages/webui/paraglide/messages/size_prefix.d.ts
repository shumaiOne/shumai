/**
 * | output |
 * | --- |
 * | "Size:" |
 *
 * @param {Size_PrefixInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const size_prefix: ((
  inputs?: Size_PrefixInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Size_PrefixInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Size_PrefixInputs = {}
