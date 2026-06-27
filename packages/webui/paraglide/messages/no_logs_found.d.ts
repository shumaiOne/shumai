/**
 * | output |
 * | --- |
 * | "No logs found for this session." |
 *
 * @param {No_Logs_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_logs_found: ((
  inputs?: No_Logs_FoundInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Logs_FoundInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Logs_FoundInputs = {}
