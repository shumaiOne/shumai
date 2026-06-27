/**
 * | output |
 * | --- |
 * | "You are a member of multiple teams. Please select one to continue." |
 *
 * @param {Select_Team_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_team_description: ((
  inputs?: Select_Team_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Select_Team_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Select_Team_DescriptionInputs = {}
