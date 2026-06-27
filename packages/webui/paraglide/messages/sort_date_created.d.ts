/**
 * | output |
 * | --- |
 * | "Date Created" |
 *
 * @param {Sort_Date_CreatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_date_created: ((
  inputs?: Sort_Date_CreatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sort_Date_CreatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sort_Date_CreatedInputs = {}
