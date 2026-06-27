/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} OrderInputs */

const en_order = /** @type {(inputs: OrderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Order`)
}

const zh_order = /** @type {(inputs: OrderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`顺序`)
}

/**
 * | output |
 * | --- |
 * | "Order" |
 *
 * @param {OrderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const order =
  /** @type {((inputs?: OrderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<OrderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_order(inputs)
      return zh_order(inputs)
    }
  )
