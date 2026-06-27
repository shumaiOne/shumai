/**
 * | output |
 * | --- |
 * | "Variable Name" |
 *
 * @param {Variable_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const variable_name: ((
  inputs?: Variable_NameInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Variable_NameInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Variable_NameInputs = {}
