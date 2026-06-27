/**
 * | output |
 * | --- |
 * | "Provider created successfully" |
 *
 * @param {Provider_Created_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const provider_created_successfully: ((
  inputs?: Provider_Created_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Provider_Created_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Provider_Created_SuccessfullyInputs = {}
