/**
 * | output |
 * | --- |
 * | "Password Protected" |
 *
 * @param {Password_ProtectedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const password_protected: ((
  inputs?: Password_ProtectedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Password_ProtectedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Password_ProtectedInputs = {}
