/**
 * | output |
 * | --- |
 * | "Manage your profile name and avatar image." |
 *
 * @param {Personal_Info_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const personal_info_description: ((
  inputs?: Personal_Info_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Personal_Info_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Personal_Info_DescriptionInputs = {}
