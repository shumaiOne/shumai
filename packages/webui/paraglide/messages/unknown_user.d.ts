/**
 * | output |
 * | --- |
 * | "Unknown User" |
 *
 * @param {Unknown_UserInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const unknown_user: ((
  inputs?: Unknown_UserInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Unknown_UserInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Unknown_UserInputs = {}
