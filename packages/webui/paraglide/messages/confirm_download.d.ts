/**
 * | output |
 * | --- |
 * | "Confirm Download" |
 *
 * @param {Confirm_DownloadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const confirm_download: ((
  inputs?: Confirm_DownloadInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Confirm_DownloadInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Confirm_DownloadInputs = {}
