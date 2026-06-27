/**
 * | output |
 * | --- |
 * | "unknown project" |
 *
 * @param {Unknown_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const unknown_project: ((
  inputs?: Unknown_ProjectInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Unknown_ProjectInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Unknown_ProjectInputs = {}
