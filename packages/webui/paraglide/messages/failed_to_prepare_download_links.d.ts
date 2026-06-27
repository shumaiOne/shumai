/**
 * | output |
 * | --- |
 * | "Failed to prepare download links" |
 *
 * @param {Failed_To_Prepare_Download_LinksInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_prepare_download_links: ((
  inputs?: Failed_To_Prepare_Download_LinksInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_Prepare_Download_LinksInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_Prepare_Download_LinksInputs = {}
