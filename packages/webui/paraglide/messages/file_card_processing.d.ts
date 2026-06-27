/**
 * | output |
 * | --- |
 * | "Processing" |
 *
 * @param {File_Card_ProcessingInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const file_card_processing: ((
  inputs?: File_Card_ProcessingInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    File_Card_ProcessingInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type File_Card_ProcessingInputs = {}
