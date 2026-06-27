/**
 * | output |
 * | --- |
 * | "Don't have an account?" |
 *
 * @param {No_Account_PromptInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_account_prompt: ((
  inputs?: No_Account_PromptInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Account_PromptInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Account_PromptInputs = {}
