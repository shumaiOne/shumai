/**
 * | output |
 * | --- |
 * | "Package Upload" |
 *
 * @param {Package_UploadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const package_upload: ((
  inputs?: Package_UploadInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Package_UploadInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Package_UploadInputs = {}
