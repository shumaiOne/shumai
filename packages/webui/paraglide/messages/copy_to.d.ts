/**
 * | output |
 * | --- |
 * | "Copy to" |
 *
 * @param {Copy_ToInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const copy_to: ((
  inputs?: Copy_ToInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Copy_ToInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Copy_ToInputs = {}
