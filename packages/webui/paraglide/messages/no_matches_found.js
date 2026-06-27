/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Matches_FoundInputs */

const en_no_matches_found =
  /** @type {(inputs: No_Matches_FoundInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`No matches found`)
  }

const zh_no_matches_found =
  /** @type {(inputs: No_Matches_FoundInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`未找到匹配结果`)
  }

/**
 * | output |
 * | --- |
 * | "No matches found" |
 *
 * @param {No_Matches_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_matches_found =
  /** @type {((inputs?: No_Matches_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Matches_FoundInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_matches_found(inputs)
      return zh_no_matches_found(inputs)
    }
  )
