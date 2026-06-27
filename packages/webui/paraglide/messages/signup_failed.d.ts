/**
 * | output |
 * | --- |
 * | "Signup failed" |
 *
 * @param {Signup_FailedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const signup_failed: ((
  inputs?: Signup_FailedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Signup_FailedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Signup_FailedInputs = {}
