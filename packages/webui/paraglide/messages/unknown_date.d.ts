/**
 * | output |
 * | --- |
 * | "Unknown Date" |
 *
 * @param {Unknown_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const unknown_date: ((
  inputs?: Unknown_DateInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Unknown_DateInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Unknown_DateInputs = {}
