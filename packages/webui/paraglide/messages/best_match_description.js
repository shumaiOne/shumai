/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Best_Match_DescriptionInputs */

const en_best_match_description =
  /** @type {(inputs: Best_Match_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Generates a single optimal resolution matching the source quality.`
    )
  }

const zh_best_match_description =
  /** @type {(inputs: Best_Match_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`生成与源质量匹配的单一最优分辨率。`)
  }

/**
 * | output |
 * | --- |
 * | "Generates a single optimal resolution matching the source quality." |
 *
 * @param {Best_Match_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const best_match_description =
  /** @type {((inputs?: Best_Match_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Best_Match_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_best_match_description(inputs)
      return zh_best_match_description(inputs)
    }
  )
