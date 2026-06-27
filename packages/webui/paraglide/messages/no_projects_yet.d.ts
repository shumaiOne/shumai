/**
 * | output |
 * | --- |
 * | "No projects yet." |
 *
 * @param {No_Projects_YetInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_projects_yet: ((
  inputs?: No_Projects_YetInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Projects_YetInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Projects_YetInputs = {}
