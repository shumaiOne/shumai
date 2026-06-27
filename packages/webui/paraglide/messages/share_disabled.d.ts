/**
 * | output |
 * | --- |
 * | "Share Disabled" |
 *
 * @param {Share_DisabledInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_disabled: ((
  inputs?: Share_DisabledInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Share_DisabledInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Share_DisabledInputs = {}
