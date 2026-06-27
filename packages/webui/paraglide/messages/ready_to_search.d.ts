/**
 * | output |
 * | --- |
 * | "Ready to Search" |
 *
 * @param {Ready_To_SearchInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const ready_to_search: ((
  inputs?: Ready_To_SearchInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Ready_To_SearchInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Ready_To_SearchInputs = {}
