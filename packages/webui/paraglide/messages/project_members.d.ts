/**
 * | output |
 * | --- |
 * | "Project Members" |
 *
 * @param {Project_MembersInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_members: ((
  inputs?: Project_MembersInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Project_MembersInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Project_MembersInputs = {}
