/**
 * | output |
 * | --- |
 * | "Open Share Link" |
 *
 * @param {Open_Share_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const open_share_link: ((
  inputs?: Open_Share_LinkInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Open_Share_LinkInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Open_Share_LinkInputs = {}
