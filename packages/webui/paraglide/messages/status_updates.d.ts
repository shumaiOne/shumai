/**
 * | output |
 * | --- |
 * | "Status Updates" |
 *
 * @param {Status_UpdatesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const status_updates: ((
  inputs?: Status_UpdatesInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Status_UpdatesInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Status_UpdatesInputs = {}
