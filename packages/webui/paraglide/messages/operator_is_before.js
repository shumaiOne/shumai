/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Operator_Is_BeforeInputs */

const en_operator_is_before =
  /** @type {(inputs: Operator_Is_BeforeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`is before`)
  }

const zh_operator_is_before =
  /** @type {(inputs: Operator_Is_BeforeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`在之前`)
  }

/**
 * | output |
 * | --- |
 * | "is before" |
 *
 * @param {Operator_Is_BeforeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const operator_is_before =
  /** @type {((inputs?: Operator_Is_BeforeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Operator_Is_BeforeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_operator_is_before(inputs)
      return zh_operator_is_before(inputs)
    }
  )
