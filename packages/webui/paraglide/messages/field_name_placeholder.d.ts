/**
 * | output |
 * | --- |
 * | "e.g. Status" |
 *
 * @param {Field_Name_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const field_name_placeholder: ((
  inputs?: Field_Name_PlaceholderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Field_Name_PlaceholderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Field_Name_PlaceholderInputs = {}
