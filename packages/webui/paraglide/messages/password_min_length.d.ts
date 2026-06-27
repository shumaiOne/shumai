/**
 * | output |
 * | --- |
 * | "Password must be at least 3 characters" |
 *
 * @param {Password_Min_LengthInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const password_min_length: ((
  inputs?: Password_Min_LengthInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Password_Min_LengthInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Password_Min_LengthInputs = {}
