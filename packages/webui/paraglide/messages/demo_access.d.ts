/**
 * | output |
 * | --- |
 * | "Demo Access:" |
 *
 * @param {Demo_AccessInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const demo_access: ((
  inputs?: Demo_AccessInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Demo_AccessInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Demo_AccessInputs = {}
