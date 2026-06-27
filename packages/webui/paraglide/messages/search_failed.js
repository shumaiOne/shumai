/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Search_FailedInputs */

const en_search_failed = /** @type {(inputs: Search_FailedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Search failed`)
}

const zh_search_failed = /** @type {(inputs: Search_FailedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`搜索失败`)
}

/**
 * | output |
 * | --- |
 * | "Search failed" |
 *
 * @param {Search_FailedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const search_failed =
  /** @type {((inputs?: Search_FailedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Search_FailedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_search_failed(inputs)
      return zh_search_failed(inputs)
    }
  )
