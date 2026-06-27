/**
 * | output |
 * | --- |
 * | "Enter API Key or Environment Variable" |
 *
 * @param {Api_Key_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const api_key_placeholder: ((
  inputs?: Api_Key_PlaceholderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Api_Key_PlaceholderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Api_Key_PlaceholderInputs = {}
