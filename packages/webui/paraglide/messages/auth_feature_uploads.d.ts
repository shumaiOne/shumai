/**
 * | output |
 * | --- |
 * | "Instant asset uploads & high-fidelity media players" |
 *
 * @param {Auth_Feature_UploadsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const auth_feature_uploads: ((
  inputs?: Auth_Feature_UploadsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Auth_Feature_UploadsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Auth_Feature_UploadsInputs = {}
