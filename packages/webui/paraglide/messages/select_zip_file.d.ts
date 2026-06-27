/**
 * | output |
 * | --- |
 * | "Select ZIP file" |
 *
 * @param {Select_Zip_FileInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_zip_file: ((
  inputs?: Select_Zip_FileInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Select_Zip_FileInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Select_Zip_FileInputs = {}
