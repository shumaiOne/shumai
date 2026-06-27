/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_NotInputs */

const en_operator_is_not = /** @type {(inputs: Operator_Is_NotInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`is not`)
}

const zh_operator_is_not = /** @type {(inputs: Operator_Is_NotInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`不是`)
}

/**
 * | output |
 * | --- |
 * | "is not" |
 *
 * @param {Operator_Is_NotInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_not =
  /** @type {((inputs?: Operator_Is_NotInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_NotInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_is_not(inputs)
      return zh_operator_is_not(inputs)
    }
  )
