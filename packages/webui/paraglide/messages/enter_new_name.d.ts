/**
 * | output |
 * | --- |
 * | "Enter new name" |
 *
 * @param {Enter_New_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_new_name: ((
  inputs?: Enter_New_NameInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Enter_New_NameInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Enter_New_NameInputs = {}
