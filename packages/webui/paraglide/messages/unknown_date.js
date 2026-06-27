/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unknown_DateInputs */

const en_unknown_date = /** @type {(inputs: Unknown_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Unknown Date`)
}

const zh_unknown_date = /** @type {(inputs: Unknown_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`未知日期`)
}

/**
 * | output |
 * | --- |
 * | "Unknown Date" |
 *
 * @param {Unknown_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const unknown_date =
  /** @type {((inputs?: Unknown_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unknown_DateInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_unknown_date(inputs)
      return zh_unknown_date(inputs)
    }
  )
