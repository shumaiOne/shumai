/**
 * | output |
 * | --- |
 * | "Delete field" |
 *
 * @param {Delete_FieldInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_field: ((
  inputs?: Delete_FieldInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_FieldInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_FieldInputs = {}
