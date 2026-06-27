/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_On_Or_AfterInputs */

const en_operator_is_on_or_after =
  /** @type {(inputs: Operator_Is_On_Or_AfterInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`is on or after`)
  }

const zh_operator_is_on_or_after =
  /** @type {(inputs: Operator_Is_On_Or_AfterInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`在当天或之后`)
  }

/**
 * | output |
 * | --- |
 * | "is on or after" |
 *
 * @param {Operator_Is_On_Or_AfterInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_on_or_after =
  /** @type {((inputs?: Operator_Is_On_Or_AfterInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_On_Or_AfterInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_is_on_or_after(inputs)
      return zh_operator_is_on_or_after(inputs)
    }
  )
