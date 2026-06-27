/**
 * | output |
 * | --- |
 * | "is on or before" |
 *
 * @param {Operator_Is_On_Or_BeforeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_on_or_before: ((
  inputs?: Operator_Is_On_Or_BeforeInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Operator_Is_On_Or_BeforeInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Operator_Is_On_Or_BeforeInputs = {}
