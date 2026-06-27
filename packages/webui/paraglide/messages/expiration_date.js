/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Expiration_DateInputs */

const en_expiration_date = /** @type {(inputs: Expiration_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Expiration Date`)
}

const zh_expiration_date = /** @type {(inputs: Expiration_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`过期日期`)
}

/**
 * | output |
 * | --- |
 * | "Expiration Date" |
 *
 * @param {Expiration_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const expiration_date =
  /** @type {((inputs?: Expiration_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Expiration_DateInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_expiration_date(inputs)
      return zh_expiration_date(inputs)
    }
  )
