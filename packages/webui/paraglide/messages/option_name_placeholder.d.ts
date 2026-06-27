/**
 * | output |
 * | --- |
 * | "Option name" |
 *
 * @param {Option_Name_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const option_name_placeholder: ((
  inputs?: Option_Name_PlaceholderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Option_Name_PlaceholderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Option_Name_PlaceholderInputs = {}
