/**
 * | output |
 * | --- |
 * | "No environment variables found. Click \"Add Variable\" to create one." |
 *
 * @param {No_Env_Vars_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_env_vars_found: ((
  inputs?: No_Env_Vars_FoundInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Env_Vars_FoundInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Env_Vars_FoundInputs = {}
