/**
 * | output |
 * | --- |
 * | "Add Skill" |
 *
 * @param {Add_SkillInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_skill: ((
  inputs?: Add_SkillInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Add_SkillInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Add_SkillInputs = {}
