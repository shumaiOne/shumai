/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_ContainsInputs */

const en_operator_contains =
  /** @type {(inputs: Operator_ContainsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`contains`)
  }

const zh_operator_contains =
  /** @type {(inputs: Operator_ContainsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`包含`)
  }

/**
 * | output |
 * | --- |
 * | "contains" |
 *
 * @param {Operator_ContainsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_contains =
  /** @type {((inputs?: Operator_ContainsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_ContainsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_contains(inputs)
      return zh_operator_contains(inputs)
    }
  )
