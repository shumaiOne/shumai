/**
 * | output |
 * | --- |
 * | "Custom metadata schemas & drawing canvas reviews" |
 *
 * @param {Auth_Feature_MetadataInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const auth_feature_metadata: ((
  inputs?: Auth_Feature_MetadataInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Auth_Feature_MetadataInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Auth_Feature_MetadataInputs = {}
