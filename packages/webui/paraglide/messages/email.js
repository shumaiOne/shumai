/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} EmailInputs */

const en_email = /** @type {(inputs: EmailInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Email`)
}

const zh_email = /** @type {(inputs: EmailInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`邮箱`)
}

/**
 * | output |
 * | --- |
 * | "Email" |
 *
 * @param {EmailInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const email =
  /** @type {((inputs?: EmailInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<EmailInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_email(inputs)
      return zh_email(inputs)
    }
  )
