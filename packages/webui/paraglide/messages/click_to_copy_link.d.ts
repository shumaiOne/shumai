/**
 * | output |
 * | --- |
 * | "Click to copy link" |
 *
 * @param {Click_To_Copy_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const click_to_copy_link: ((
  inputs?: Click_To_Copy_LinkInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Click_To_Copy_LinkInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Click_To_Copy_LinkInputs = {}
