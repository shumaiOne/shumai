/**
 * | output |
 * | --- |
 * | "contains" |
 *
 * @param {Operator_ContainsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_contains: ((
  inputs?: Operator_ContainsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Operator_ContainsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Operator_ContainsInputs = {}
