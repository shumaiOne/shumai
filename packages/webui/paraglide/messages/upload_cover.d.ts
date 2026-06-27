/**
 * | output |
 * | --- |
 * | "Upload cover" |
 *
 * @param {Upload_CoverInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const upload_cover: ((
  inputs?: Upload_CoverInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Upload_CoverInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Upload_CoverInputs = {}
