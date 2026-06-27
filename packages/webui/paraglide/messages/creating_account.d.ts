/**
 * | output |
 * | --- |
 * | "Creating account..." |
 *
 * @param {Creating_AccountInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const creating_account: ((
  inputs?: Creating_AccountInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Creating_AccountInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Creating_AccountInputs = {}
