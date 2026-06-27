/**
 * | output |
 * | --- |
 * | "and" |
 *
 * @param {Filter_AndInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const filter_and: ((
  inputs?: Filter_AndInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Filter_AndInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Filter_AndInputs = {}
