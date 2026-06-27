/**
 * | output |
 * | --- |
 * | "Enter your credentials to access your account." |
 *
 * @param {Login_SubtitleInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const login_subtitle: ((
  inputs?: Login_SubtitleInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Login_SubtitleInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Login_SubtitleInputs = {}
