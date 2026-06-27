/**
 * | output |
 * | --- |
 * | "Failed to update member role" |
 *
 * @param {Failed_To_Update_Member_RoleInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_update_member_role: ((
  inputs?: Failed_To_Update_Member_RoleInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_Update_Member_RoleInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_Update_Member_RoleInputs = {}
