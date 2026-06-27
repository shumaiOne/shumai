/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_IsInputs */

const en_operator_is = /** @type {(inputs: Operator_IsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`is`)
}

const zh_operator_is = /** @type {(inputs: Operator_IsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`是`)
}

/**
 * | output |
 * | --- |
 * | "is" |
 *
 * @param {Operator_IsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is =
  /** @type {((inputs?: Operator_IsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_IsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_is(inputs)
      return zh_operator_is(inputs)
    }
  )
