/**
 * | output |
 * | --- |
 * | "All Share Links ({count})" |
 *
 * @param {All_Share_Links_CountInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const all_share_links_count: ((
  inputs: All_Share_Links_CountInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    All_Share_Links_CountInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type All_Share_Links_CountInputs = {
  count: NonNullable<unknown>
}
