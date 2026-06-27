/**
 * | output |
 * | --- |
 * | "Team Attributes" |
 *
 * @param {Team_AttributesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const team_attributes: ((
  inputs?: Team_AttributesInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Team_AttributesInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Team_AttributesInputs = {}
