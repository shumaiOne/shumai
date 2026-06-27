/**
 * | output |
 * | --- |
 * | "Project updated" |
 *
 * @param {Project_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_updated: ((
  inputs?: Project_UpdatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Project_UpdatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Project_UpdatedInputs = {}
