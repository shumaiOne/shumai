/**
 * | output |
 * | --- |
 * | "Are you absolutely sure?" |
 *
 * @param {Are_You_Absolutely_SureInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const are_you_absolutely_sure: ((
  inputs?: Are_You_Absolutely_SureInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Are_You_Absolutely_SureInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Are_You_Absolutely_SureInputs = {}
