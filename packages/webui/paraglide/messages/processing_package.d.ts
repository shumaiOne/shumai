/**
 * | output |
 * | --- |
 * | "Processing package..." |
 *
 * @param {Processing_PackageInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const processing_package: ((
  inputs?: Processing_PackageInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Processing_PackageInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Processing_PackageInputs = {}
