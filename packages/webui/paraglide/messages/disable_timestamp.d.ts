/**
 * | output |
 * | --- |
 * | "Disable Timestamp" |
 *
 * @param {Disable_TimestampInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const disable_timestamp: ((
  inputs?: Disable_TimestampInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Disable_TimestampInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Disable_TimestampInputs = {}
