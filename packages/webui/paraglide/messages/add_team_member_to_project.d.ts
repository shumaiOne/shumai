/**
 * | output |
 * | --- |
 * | "Add Team Member to Project" |
 *
 * @param {Add_Team_Member_To_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_team_member_to_project: ((
  inputs?: Add_Team_Member_To_ProjectInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Add_Team_Member_To_ProjectInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Add_Team_Member_To_ProjectInputs = {}
