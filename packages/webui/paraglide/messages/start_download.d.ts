/**
 * | output |
 * | --- |
 * | "Start Download" |
 *
 * @param {Start_DownloadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const start_download: ((
  inputs?: Start_DownloadInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Start_DownloadInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Start_DownloadInputs = {}
