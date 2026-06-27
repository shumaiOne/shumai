/**
 * | output |
 * | --- |
 * | "Enter your name" |
 *
 * @param {Enter_Your_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_your_name: ((
  inputs?: Enter_Your_NameInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Enter_Your_NameInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Enter_Your_NameInputs = {}
