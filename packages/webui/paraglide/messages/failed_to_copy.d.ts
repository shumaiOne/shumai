/**
 * | output |
 * | --- |
 * | "Failed to copy" |
 *
 * @param {Failed_To_CopyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_copy: ((
  inputs?: Failed_To_CopyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_CopyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_CopyInputs = {}
