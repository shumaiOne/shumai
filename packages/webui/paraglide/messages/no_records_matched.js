/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Records_MatchedInputs */

const en_no_records_matched =
  /** @type {(inputs: No_Records_MatchedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`No records matched your criteria`)
  }

const zh_no_records_matched =
  /** @type {(inputs: No_Records_MatchedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`没有记录匹配您的条件`)
  }

/**
 * | output |
 * | --- |
 * | "No records matched your criteria" |
 *
 * @param {No_Records_MatchedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_records_matched =
  /** @type {((inputs?: No_Records_MatchedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Records_MatchedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_records_matched(inputs)
      return zh_no_records_matched(inputs)
    }
  )
