/**
 * | output |
 * | --- |
 * | "Preparing download links..." |
 *
 * @param {Preparing_Download_LinksInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const preparing_download_links: ((
  inputs?: Preparing_Download_LinksInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Preparing_Download_LinksInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Preparing_Download_LinksInputs = {}
