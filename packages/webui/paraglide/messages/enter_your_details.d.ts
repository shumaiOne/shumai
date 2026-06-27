/**
 * | output |
 * | --- |
 * | "Enter your details" |
 *
 * @param {Enter_Your_DetailsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_your_details: ((
  inputs?: Enter_Your_DetailsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Enter_Your_DetailsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Enter_Your_DetailsInputs = {}
