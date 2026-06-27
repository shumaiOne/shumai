/**
 * | output |
 * | --- |
 * | "Start building and organizing your space." |
 *
 * @param {Signup_SubtitleInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const signup_subtitle: ((
  inputs?: Signup_SubtitleInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Signup_SubtitleInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Signup_SubtitleInputs = {}
