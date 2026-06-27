/**
 * | output |
 * | --- |
 * | "Select a project first" |
 *
 * @param {Select_Project_FirstInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_project_first: ((
  inputs?: Select_Project_FirstInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Select_Project_FirstInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Select_Project_FirstInputs = {}
