/**
 * | output |
 * | --- |
 * | "Thumbnail" |
 *
 * @param {ThumbnailInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thumbnail: ((
  inputs?: ThumbnailInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    ThumbnailInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type ThumbnailInputs = {}
