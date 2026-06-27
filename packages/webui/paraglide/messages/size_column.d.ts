/**
 * | output |
 * | --- |
 * | "Size" |
 *
 * @param {Size_ColumnInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const size_column: ((
  inputs?: Size_ColumnInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Size_ColumnInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Size_ColumnInputs = {}
