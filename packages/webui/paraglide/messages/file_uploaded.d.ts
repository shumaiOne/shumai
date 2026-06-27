/**
 * | output |
 * | --- |
 * | "File uploaded" |
 *
 * @param {File_UploadedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const file_uploaded: ((
  inputs?: File_UploadedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    File_UploadedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type File_UploadedInputs = {}
