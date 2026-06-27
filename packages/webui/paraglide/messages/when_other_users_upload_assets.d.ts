/**
 * | output |
 * | --- |
 * | "When other users upload assets" |
 *
 * @param {When_Other_Users_Upload_AssetsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const when_other_users_upload_assets: ((
  inputs?: When_Other_Users_Upload_AssetsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    When_Other_Users_Upload_AssetsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type When_Other_Users_Upload_AssetsInputs = {}
