/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FiltersInputs */

const en_filters = /** @type {(inputs: FiltersInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Filters`)
}

const zh_filters = /** @type {(inputs: FiltersInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`筛选条件`)
}

/**
 * | output |
 * | --- |
 * | "Filters" |
 *
 * @param {FiltersInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const filters =
  /** @type {((inputs?: FiltersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FiltersInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_filters(inputs)
      return zh_filters(inputs)
    }
  )
