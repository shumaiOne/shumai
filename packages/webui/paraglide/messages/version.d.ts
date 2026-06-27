/**
 * | output |
 * | --- |
 * | "Version {version}" |
 *
 * @param {VersionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const version: ((
  inputs: VersionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    VersionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type VersionInputs = {
  version: NonNullable<unknown>
}
