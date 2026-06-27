/**
 * | output |
 * | --- |
 * | "Project Member" |
 *
 * @param {Project_MemberInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_member: ((
  inputs?: Project_MemberInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Project_MemberInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Project_MemberInputs = {}
