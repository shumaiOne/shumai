/**
 * | output |
 * | --- |
 * | "Projects" |
 *
 * @param {ProjectsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const projects: ((
  inputs?: ProjectsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    ProjectsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type ProjectsInputs = {}
