/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FilterInputs */

const en_filter = /** @type {(inputs: FilterInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Filter`)
}

const zh_filter = /** @type {(inputs: FilterInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`筛选`)
}

/**
 * | output |
 * | --- |
 * | "Filter" |
 *
 * @param {FilterInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const filter =
  /** @type {((inputs?: FilterInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FilterInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_filter(inputs)
      return zh_filter(inputs)
    }
  )
