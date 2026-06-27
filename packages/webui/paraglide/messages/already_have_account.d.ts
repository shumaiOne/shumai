/**
 * | output |
 * | --- |
 * | "Already have an account?" |
 *
 * @param {Already_Have_AccountInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const already_have_account: ((
  inputs?: Already_Have_AccountInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Already_Have_AccountInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Already_Have_AccountInputs = {}
