/**
 * | output |
 * | --- |
 * | "Failed to restore" |
 *
 * @param {Failed_To_RestoreInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_restore: ((
  inputs?: Failed_To_RestoreInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_RestoreInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_RestoreInputs = {}
