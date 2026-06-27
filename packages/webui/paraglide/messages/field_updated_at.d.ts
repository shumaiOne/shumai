/**
 * | output |
 * | --- |
 * | "Updated At" |
 *
 * @param {Field_Updated_AtInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const field_updated_at: ((
  inputs?: Field_Updated_AtInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Field_Updated_AtInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Field_Updated_AtInputs = {}
