/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SearchInputs */

const en_search = /** @type {(inputs: SearchInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Search`)
}

const zh_search = /** @type {(inputs: SearchInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`搜索`)
}

/**
 * | output |
 * | --- |
 * | "Search" |
 *
 * @param {SearchInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const search =
  /** @type {((inputs?: SearchInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SearchInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_search(inputs)
      return zh_search(inputs)
    }
  )
