/**
 * | output |
 * | --- |
 * | "Delete Share Link?" |
 *
 * @param {Delete_Share_Link_ConfirmInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_share_link_confirm: ((
  inputs?: Delete_Share_Link_ConfirmInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_Share_Link_ConfirmInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_Share_Link_ConfirmInputs = {}
