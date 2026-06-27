/**
 * | output |
 * | --- |
 * | "Frictionless team workspaces & secure sharing" |
 *
 * @param {Auth_Feature_TeamsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const auth_feature_teams: ((
  inputs?: Auth_Feature_TeamsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Auth_Feature_TeamsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Auth_Feature_TeamsInputs = {}
