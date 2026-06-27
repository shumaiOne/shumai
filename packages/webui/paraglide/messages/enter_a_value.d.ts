/**
 * | output |
 * | --- |
 * | "Enter a value" |
 *
 * @param {Enter_A_ValueInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_a_value: ((
  inputs?: Enter_A_ValueInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Enter_A_ValueInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Enter_A_ValueInputs = {}
