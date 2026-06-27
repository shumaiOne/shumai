/**
 * | output |
 * | --- |
 * | "Created" |
 *
 * @param {Sort_CreatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_created: ((
  inputs?: Sort_CreatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sort_CreatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sort_CreatedInputs = {}
