/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Best_MatchInputs */

const en_best_match = /** @type {(inputs: Best_MatchInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Best match`)
}

const zh_best_match = /** @type {(inputs: Best_MatchInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`最佳匹配`)
}

/**
 * | output |
 * | --- |
 * | "Best match" |
 *
 * @param {Best_MatchInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const best_match =
  /** @type {((inputs?: Best_MatchInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Best_MatchInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_best_match(inputs)
      return zh_best_match(inputs)
    }
  )
