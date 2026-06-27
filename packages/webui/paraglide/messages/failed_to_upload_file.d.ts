/**
 * | output |
 * | --- |
 * | "Failed to upload file: {name}" |
 *
 * @param {Failed_To_Upload_FileInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_upload_file: ((
  inputs: Failed_To_Upload_FileInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_Upload_FileInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_Upload_FileInputs = {
  name: NonNullable<unknown>
}
