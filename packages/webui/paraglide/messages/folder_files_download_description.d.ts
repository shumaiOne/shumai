/**
 * | output |
 * | --- |
 * | "Selected folder files will be prepared for download." |
 *
 * @param {Folder_Files_Download_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const folder_files_download_description: ((
  inputs?: Folder_Files_Download_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Folder_Files_Download_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Folder_Files_Download_DescriptionInputs = {}
