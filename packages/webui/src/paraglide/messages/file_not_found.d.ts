/**
 * | output |
 * | --- |
 * | "File not found." |
 *
 * @param {File_Not_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const file_not_found: ((
  inputs?: File_Not_FoundInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    File_Not_FoundInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type File_Not_FoundInputs = {}
