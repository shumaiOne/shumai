/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Does_Not_ContainInputs */

const en_operator_does_not_contain =
  /** @type {(inputs: Operator_Does_Not_ContainInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`does not contain`)
  }

const zh_operator_does_not_contain =
  /** @type {(inputs: Operator_Does_Not_ContainInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`不包含`)
  }

/**
 * | output |
 * | --- |
 * | "does not contain" |
 *
 * @param {Operator_Does_Not_ContainInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_does_not_contain =
  /** @type {((inputs?: Operator_Does_Not_ContainInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Does_Not_ContainInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_does_not_contain(inputs)
      return zh_operator_does_not_contain(inputs)
    }
  )
