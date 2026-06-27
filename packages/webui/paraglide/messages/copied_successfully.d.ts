/**
 * | output |
 * | --- |
 * | "Copied successfully" |
 *
 * @param {Copied_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const copied_successfully: ((
  inputs?: Copied_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Copied_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Copied_SuccessfullyInputs = {}
