/**
 * | output |
 * | --- |
 * | "Personal Info" |
 *
 * @param {Personal_InfoInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const personal_info: ((
  inputs?: Personal_InfoInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Personal_InfoInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Personal_InfoInputs = {}
