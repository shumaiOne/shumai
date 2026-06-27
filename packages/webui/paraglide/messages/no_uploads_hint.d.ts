/**
 * | output |
 * | --- |
 * | "Upload files in the project view to track progress here." |
 *
 * @param {No_Uploads_HintInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_uploads_hint: ((
  inputs?: No_Uploads_HintInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Uploads_HintInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Uploads_HintInputs = {}
