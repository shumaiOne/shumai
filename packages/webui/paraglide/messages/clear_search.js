/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Clear_SearchInputs */

const en_clear_search = /** @type {(inputs: Clear_SearchInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Clear search`)
}

const zh_clear_search = /** @type {(inputs: Clear_SearchInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`清除搜索`)
}

/**
 * | output |
 * | --- |
 * | "Clear search" |
 *
 * @param {Clear_SearchInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const clear_search =
  /** @type {((inputs?: Clear_SearchInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Clear_SearchInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_clear_search(inputs)
      return zh_clear_search(inputs)
    }
  )
