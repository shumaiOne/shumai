/**
 * | output |
 * | --- |
 * | "Share link created" |
 *
 * @param {Share_Link_CreatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_link_created: ((
  inputs?: Share_Link_CreatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Share_Link_CreatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Share_Link_CreatedInputs = {}
