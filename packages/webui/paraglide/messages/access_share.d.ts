/**
 * | output |
 * | --- |
 * | "Access Share" |
 *
 * @param {Access_ShareInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const access_share: ((
  inputs?: Access_ShareInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Access_ShareInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Access_ShareInputs = {}
