/**
 * | output |
 * | --- |
 * | "Clear search" |
 *
 * @param {Clear_SearchInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const clear_search: ((
  inputs?: Clear_SearchInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Clear_SearchInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Clear_SearchInputs = {}
