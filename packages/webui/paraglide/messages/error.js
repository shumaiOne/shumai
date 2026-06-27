/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ErrorInputs */

const en_error = /** @type {(inputs: ErrorInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Error`)
}

const zh_error = /** @type {(inputs: ErrorInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`错误`)
}

/**
 * | output |
 * | --- |
 * | "Error" |
 *
 * @param {ErrorInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const error =
  /** @type {((inputs?: ErrorInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ErrorInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_error(inputs)
      return zh_error(inputs)
    }
  )
