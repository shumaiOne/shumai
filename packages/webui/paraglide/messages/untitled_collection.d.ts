/**
 * | output |
 * | --- |
 * | "Untitled Collection" |
 *
 * @param {Untitled_CollectionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const untitled_collection: ((
  inputs?: Untitled_CollectionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Untitled_CollectionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Untitled_CollectionInputs = {}
