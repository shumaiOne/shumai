/**
 * | output |
 * | --- |
 * | "Failed to generate invite link" |
 *
 * @param {Failed_To_Generate_Invite_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_generate_invite_link: ((
  inputs?: Failed_To_Generate_Invite_LinkInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_Generate_Invite_LinkInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_Generate_Invite_LinkInputs = {}
