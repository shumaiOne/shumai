/**
 * | output |
 * | --- |
 * | "Manage and update your project workspace configurations." |
 *
 * @param {Manage_Project_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const manage_project_description: ((
  inputs?: Manage_Project_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Manage_Project_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Manage_Project_DescriptionInputs = {}
