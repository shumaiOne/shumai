/**
 * | output |
 * | --- |
 * | "Provider Name" |
 *
 * @param {Provider_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const provider_name: ((
  inputs?: Provider_NameInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Provider_NameInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Provider_NameInputs = {}
