/**
 * | output |
 * | --- |
 * | "Create Account" |
 *
 * @param {Create_AccountInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const create_account: ((
  inputs?: Create_AccountInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Create_AccountInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Create_AccountInputs = {}
