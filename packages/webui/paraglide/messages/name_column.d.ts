/**
 * | output |
 * | --- |
 * | "Name" |
 *
 * @param {Name_ColumnInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const name_column: ((
  inputs?: Name_ColumnInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Name_ColumnInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Name_ColumnInputs = {}
