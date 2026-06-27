/**
 * | output |
 * | --- |
 * | "New Folder" |
 *
 * @param {New_FolderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const new_folder: ((
  inputs?: New_FolderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    New_FolderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type New_FolderInputs = {}
