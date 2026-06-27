/**
 * | output |
 * | --- |
 * | "Rename Collection" |
 *
 * @param {Rename_CollectionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const rename_collection: ((
  inputs?: Rename_CollectionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Rename_CollectionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Rename_CollectionInputs = {}
