/**
 * | output |
 * | --- |
 * | "Upload Folder" |
 *
 * @param {Upload_FolderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const upload_folder: ((
  inputs?: Upload_FolderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Upload_FolderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Upload_FolderInputs = {}
