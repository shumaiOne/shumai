/**
 * | output |
 * | --- |
 * | "Go to folder" |
 *
 * @param {Go_To_FolderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const go_to_folder: ((
  inputs?: Go_To_FolderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Go_To_FolderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Go_To_FolderInputs = {}
