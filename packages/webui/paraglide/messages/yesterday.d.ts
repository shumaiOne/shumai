/**
 * | output |
 * | --- |
 * | "Yesterday" |
 *
 * @param {YesterdayInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const yesterday: ((
  inputs?: YesterdayInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    YesterdayInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type YesterdayInputs = {}
