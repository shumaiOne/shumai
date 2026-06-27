/**
 * | output |
 * | --- |
 * | "Unknown Field Type" |
 *
 * @param {Unknown_Field_TypeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const unknown_field_type: ((
  inputs?: Unknown_Field_TypeInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Unknown_Field_TypeInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Unknown_Field_TypeInputs = {}
