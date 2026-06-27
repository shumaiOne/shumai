/**
 * | output |
 * | --- |
 * | "Avatar removed successfully" |
 *
 * @param {Avatar_RemovedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const avatar_removed: ((
  inputs?: Avatar_RemovedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Avatar_RemovedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Avatar_RemovedInputs = {}
