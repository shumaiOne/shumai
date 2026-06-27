/**
 * | output |
 * | --- |
 * | "Starting download of {count} files. Please allow multiple downloads if prompted by your browser." |
 *
 * @param {Starting_Download_Of_N_FilesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const starting_download_of_n_files: ((
  inputs: Starting_Download_Of_N_FilesInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Starting_Download_Of_N_FilesInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Starting_Download_Of_N_FilesInputs = {
  count: NonNullable<unknown>
}
