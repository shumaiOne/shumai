/**
 * | output |
 * | --- |
 * | "Add Model" |
 *
 * @param {Add_ModelInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_model: ((
  inputs?: Add_ModelInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Add_ModelInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Add_ModelInputs = {}
