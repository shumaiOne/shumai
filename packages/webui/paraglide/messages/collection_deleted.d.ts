/**
 * | output |
 * | --- |
 * | "Collection deleted" |
 *
 * @param {Collection_DeletedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const collection_deleted: ((
  inputs?: Collection_DeletedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Collection_DeletedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Collection_DeletedInputs = {}
