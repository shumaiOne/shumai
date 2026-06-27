/**
 * | output |
 * | --- |
 * | "Drop files here to upload" |
 *
 * @param {Drop_Files_Here_To_UploadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const drop_files_here_to_upload: ((
  inputs?: Drop_Files_Here_To_UploadInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Drop_Files_Here_To_UploadInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Drop_Files_Here_To_UploadInputs = {}
