/**
 * | output |
 * | --- |
 * | "Language updated successfully" |
 *
 * @param {Language_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const language_updated: ((
  inputs?: Language_UpdatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Language_UpdatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Language_UpdatedInputs = {}
