/**
 * | output |
 * | --- |
 * | "Create new version" |
 *
 * @param {Create_New_VersionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const create_new_version: ((
  inputs?: Create_New_VersionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Create_New_VersionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Create_New_VersionInputs = {}
