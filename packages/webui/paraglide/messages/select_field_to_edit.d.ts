/**
 * | output |
 * | --- |
 * | "Select a field to edit options" |
 *
 * @param {Select_Field_To_EditInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_field_to_edit: ((
  inputs?: Select_Field_To_EditInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Select_Field_To_EditInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Select_Field_To_EditInputs = {}
