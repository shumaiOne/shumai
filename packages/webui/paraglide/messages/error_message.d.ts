/**
 * | output |
 * | --- |
 * | "Error: {message}" |
 *
 * @param {Error_MessageInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const error_message: ((
  inputs: Error_MessageInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Error_MessageInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Error_MessageInputs = {
  message: NonNullable<unknown>
}
