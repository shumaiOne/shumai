/**
 * | output |
 * | --- |
 * | "Copy Link" |
 *
 * @param {Copy_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const copy_link: ((
  inputs?: Copy_LinkInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Copy_LinkInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Copy_LinkInputs = {}
