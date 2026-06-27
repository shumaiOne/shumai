/**
 * | output |
 * | --- |
 * | "When someone replies to your comment" |
 *
 * @param {When_Someone_RepliesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const when_someone_replies: ((
  inputs?: When_Someone_RepliesInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    When_Someone_RepliesInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type When_Someone_RepliesInputs = {}
