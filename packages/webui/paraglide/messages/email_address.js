/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Email_AddressInputs */

const en_email_address = /** @type {(inputs: Email_AddressInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Email Address`)
}

const zh_email_address = /** @type {(inputs: Email_AddressInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`邮箱地址`)
}

/**
 * | output |
 * | --- |
 * | "Email Address" |
 *
 * @param {Email_AddressInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const email_address =
  /** @type {((inputs?: Email_AddressInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Email_AddressInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_email_address(inputs)
      return zh_email_address(inputs)
    }
  )
