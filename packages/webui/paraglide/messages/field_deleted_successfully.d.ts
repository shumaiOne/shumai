/**
 * | output |
 * | --- |
 * | "Field deleted successfully" |
 *
 * @param {Field_Deleted_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const field_deleted_successfully: ((
  inputs?: Field_Deleted_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Field_Deleted_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Field_Deleted_SuccessfullyInputs = {}
