/**
 * | output |
 * | --- |
 * | "@Mentions" |
 *
 * @param {At_MentionsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const at_mentions: ((
  inputs?: At_MentionsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    At_MentionsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type At_MentionsInputs = {}
