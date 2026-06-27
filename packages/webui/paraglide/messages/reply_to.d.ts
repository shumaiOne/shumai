/**
 * | output |
 * | --- |
 * | "reply to:" |
 *
 * @param {Reply_ToInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const reply_to: ((
  inputs?: Reply_ToInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Reply_ToInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Reply_ToInputs = {}
