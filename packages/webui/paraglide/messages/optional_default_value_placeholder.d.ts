/**
 * | output |
 * | --- |
 * | "Optional default value..." |
 *
 * @param {Optional_Default_Value_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const optional_default_value_placeholder: ((
  inputs?: Optional_Default_Value_PlaceholderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Optional_Default_Value_PlaceholderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Optional_Default_Value_PlaceholderInputs = {}
