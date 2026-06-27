/**
 * | output |
 * | --- |
 * | "Override the default endpoint." |
 *
 * @param {Override_Default_EndpointInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const override_default_endpoint: ((
  inputs?: Override_Default_EndpointInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Override_Default_EndpointInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Override_Default_EndpointInputs = {}
