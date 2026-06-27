/**
 * | output |
 * | --- |
 * | "Collection saved" |
 *
 * @param {Collection_SavedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const collection_saved: ((
  inputs?: Collection_SavedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Collection_SavedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Collection_SavedInputs = {}
