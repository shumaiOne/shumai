/**
 * | output |
 * | --- |
 * | "Failed to create folder" |
 *
 * @param {Failed_Create_FolderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_create_folder: ((
  inputs?: Failed_Create_FolderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_Create_FolderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_Create_FolderInputs = {}
