/**
 * | output |
 * | --- |
 * | "Email Address" |
 *
 * @param {Email_AddressInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const email_address: ((
  inputs?: Email_AddressInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Email_AddressInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Email_AddressInputs = {}
