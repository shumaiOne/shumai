/**
 * | output |
 * | --- |
 * | "Models Configuration" |
 *
 * @param {Models_ConfigurationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const models_configuration: ((
  inputs?: Models_ConfigurationInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Models_ConfigurationInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Models_ConfigurationInputs = {}
