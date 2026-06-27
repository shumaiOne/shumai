/**
 * | output |
 * | --- |
 * | "Generate Link" |
 *
 * @param {Generate_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const generate_link: ((
  inputs?: Generate_LinkInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Generate_LinkInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Generate_LinkInputs = {}
