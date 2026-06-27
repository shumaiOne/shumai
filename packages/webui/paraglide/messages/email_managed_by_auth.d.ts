/**
 * | output |
 * | --- |
 * | "Email address is managed by authentication provider." |
 *
 * @param {Email_Managed_By_AuthInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const email_managed_by_auth: ((
  inputs?: Email_Managed_By_AuthInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Email_Managed_By_AuthInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Email_Managed_By_AuthInputs = {}
