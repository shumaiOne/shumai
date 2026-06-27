/**
 * | output |
 * | --- |
 * | "Logging in..." |
 *
 * @param {Logging_InInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const logging_in: ((
  inputs?: Logging_InInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Logging_InInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Logging_InInputs = {}
