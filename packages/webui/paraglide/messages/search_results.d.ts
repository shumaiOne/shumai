/**
 * | output |
 * | --- |
 * | "Search Results" |
 *
 * @param {Search_ResultsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const search_results: ((
  inputs?: Search_ResultsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Search_ResultsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Search_ResultsInputs = {}
