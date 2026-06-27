/**
 * | output |
 * | --- |
 * | "Date Modified" |
 *
 * @param {Sort_Date_ModifiedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_date_modified: ((
  inputs?: Sort_Date_ModifiedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sort_Date_ModifiedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sort_Date_ModifiedInputs = {}
