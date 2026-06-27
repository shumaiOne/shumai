/**
 * | output |
 * | --- |
 * | "When someone comments on an asset" |
 *
 * @param {When_Someone_CommentsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const when_someone_comments: ((
  inputs?: When_Someone_CommentsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    When_Someone_CommentsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type When_Someone_CommentsInputs = {}
