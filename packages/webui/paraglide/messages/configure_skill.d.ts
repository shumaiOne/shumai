/**
 * | output |
 * | --- |
 * | "Configure Skill: {name}" |
 *
 * @param {Configure_SkillInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const configure_skill: ((
  inputs: Configure_SkillInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Configure_SkillInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Configure_SkillInputs = {
  name: NonNullable<unknown>
}
