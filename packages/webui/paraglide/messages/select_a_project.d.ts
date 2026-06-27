/**
 * | output |
 * | --- |
 * | "Select a project" |
 *
 * @param {Select_A_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_a_project: ((
  inputs?: Select_A_ProjectInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Select_A_ProjectInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Select_A_ProjectInputs = {}
