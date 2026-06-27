/**
 * | output |
 * | --- |
 * | "Add, update and configure AI skills for the team." |
 *
 * @param {Skills_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const skills_description: ((
  inputs?: Skills_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Skills_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Skills_DescriptionInputs = {}
