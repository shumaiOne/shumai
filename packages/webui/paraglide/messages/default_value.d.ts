/**
 * | output |
 * | --- |
 * | "Default Value" |
 *
 * @param {Default_ValueInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const default_value: ((
  inputs?: Default_ValueInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Default_ValueInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Default_ValueInputs = {}
