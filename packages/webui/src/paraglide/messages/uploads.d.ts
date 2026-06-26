/**
 * | output |
 * | --- |
 * | "Uploads" |
 *
 * @param {UploadsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const uploads: ((
  inputs?: UploadsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    UploadsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type UploadsInputs = {}
