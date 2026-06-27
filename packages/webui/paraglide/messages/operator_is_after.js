/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_AfterInputs */

const en_operator_is_after =
  /** @type {(inputs: Operator_Is_AfterInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`is after`)
  }

const zh_operator_is_after =
  /** @type {(inputs: Operator_Is_AfterInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`在之后`)
  }

/**
 * | output |
 * | --- |
 * | "is after" |
 *
 * @param {Operator_Is_AfterInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_after =
  /** @type {((inputs?: Operator_Is_AfterInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_AfterInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_is_after(inputs)
      return zh_operator_is_after(inputs)
    }
  )
