/**
 * | output |
 * | --- |
 * | "Field updated successfully" |
 *
 * @param {Field_Updated_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const field_updated_successfully: ((
  inputs?: Field_Updated_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Field_Updated_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Field_Updated_SuccessfullyInputs = {}
