/**
 * | output |
 * | --- |
 * | "is exactly" |
 *
 * @param {Operator_Is_ExactlyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_exactly: ((
  inputs?: Operator_Is_ExactlyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Operator_Is_ExactlyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Operator_Is_ExactlyInputs = {}
