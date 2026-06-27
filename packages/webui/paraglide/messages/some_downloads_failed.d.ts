/**
 * | output |
 * | --- |
 * | "Some downloads could not be started" |
 *
 * @param {Some_Downloads_FailedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const some_downloads_failed: ((
  inputs?: Some_Downloads_FailedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Some_Downloads_FailedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Some_Downloads_FailedInputs = {}
