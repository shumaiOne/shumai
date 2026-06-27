/**
 * | output |
 * | --- |
 * | "Manage environment variables for this skill instance." |
 *
 * @param {Manage_Env_Vars_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const manage_env_vars_description: ((
  inputs?: Manage_Env_Vars_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Manage_Env_Vars_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Manage_Env_Vars_DescriptionInputs = {}
