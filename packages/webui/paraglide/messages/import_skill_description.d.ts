/**
 * | output |
 * | --- |
 * | "Import a skill from a local ZIP archive or a GitHub repository." |
 *
 * @param {Import_Skill_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const import_skill_description: ((
  inputs?: Import_Skill_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Import_Skill_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Import_Skill_DescriptionInputs = {}
