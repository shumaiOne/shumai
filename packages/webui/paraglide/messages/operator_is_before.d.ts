/**
 * | output |
 * | --- |
 * | "is before" |
 *
 * @param {Operator_Is_BeforeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_before: ((
  inputs?: Operator_Is_BeforeInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Operator_Is_BeforeInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Operator_Is_BeforeInputs = {}
