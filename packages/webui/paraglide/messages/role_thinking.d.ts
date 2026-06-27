/**
 * | output |
 * | --- |
 * | "Thinking" |
 *
 * @param {Role_ThinkingInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const role_thinking: ((
  inputs?: Role_ThinkingInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Role_ThinkingInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Role_ThinkingInputs = {}
