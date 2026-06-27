/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_None_OfInputs */

const en_operator_is_none_of =
  /** @type {(inputs: Operator_Is_None_OfInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`is none of`)
  }

const zh_operator_is_none_of =
  /** @type {(inputs: Operator_Is_None_OfInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`不在其中`)
  }

/**
 * | output |
 * | --- |
 * | "is none of" |
 *
 * @param {Operator_Is_None_OfInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_none_of =
  /** @type {((inputs?: Operator_Is_None_OfInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_None_OfInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_is_none_of(inputs)
      return zh_operator_is_none_of(inputs)
    }
  )
