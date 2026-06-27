/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_CustomInputs */

const en_sort_custom = /** @type {(inputs: Sort_CustomInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Custom`)
}

const zh_sort_custom = /** @type {(inputs: Sort_CustomInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`自定义`)
}

/**
 * | output |
 * | --- |
 * | "Custom" |
 *
 * @param {Sort_CustomInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_custom =
  /** @type {((inputs?: Sort_CustomInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_CustomInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sort_custom(inputs)
      return zh_sort_custom(inputs)
    }
  )
