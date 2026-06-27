/**
 * | output |
 * | --- |
 * | "Failed to upload" |
 *
 * @param {Failed_To_UploadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_upload: ((
  inputs?: Failed_To_UploadInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_UploadInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_UploadInputs = {}
