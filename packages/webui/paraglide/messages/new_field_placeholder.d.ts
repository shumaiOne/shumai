/**
 * | output |
 * | --- |
 * | "New Field" |
 *
 * @param {New_Field_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const new_field_placeholder: ((
  inputs?: New_Field_PlaceholderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    New_Field_PlaceholderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type New_Field_PlaceholderInputs = {}
