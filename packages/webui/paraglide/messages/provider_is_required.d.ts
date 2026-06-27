/**
 * | output |
 * | --- |
 * | "Provider is required" |
 *
 * @param {Provider_Is_RequiredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const provider_is_required: ((
  inputs?: Provider_Is_RequiredInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Provider_Is_RequiredInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Provider_Is_RequiredInputs = {}
