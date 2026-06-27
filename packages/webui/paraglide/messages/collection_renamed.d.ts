/**
 * | output |
 * | --- |
 * | "Collection renamed" |
 *
 * @param {Collection_RenamedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const collection_renamed: ((
  inputs?: Collection_RenamedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Collection_RenamedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Collection_RenamedInputs = {}
