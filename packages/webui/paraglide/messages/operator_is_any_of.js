/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_Any_OfInputs */

const en_operator_is_any_of =
  /** @type {(inputs: Operator_Is_Any_OfInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`is any of`)
  }

const zh_operator_is_any_of =
  /** @type {(inputs: Operator_Is_Any_OfInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`是其中之一`)
  }

/**
 * | output |
 * | --- |
 * | "is any of" |
 *
 * @param {Operator_Is_Any_OfInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_any_of =
  /** @type {((inputs?: Operator_Is_Any_OfInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_Any_OfInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_is_any_of(inputs)
      return zh_operator_is_any_of(inputs)
    }
  )
