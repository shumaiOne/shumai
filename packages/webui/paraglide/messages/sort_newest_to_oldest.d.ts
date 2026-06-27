/**
 * | output |
 * | --- |
 * | "Newest → Oldest" |
 *
 * @param {Sort_Newest_To_OldestInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_newest_to_oldest: ((
  inputs?: Sort_Newest_To_OldestInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sort_Newest_To_OldestInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sort_Newest_To_OldestInputs = {}
