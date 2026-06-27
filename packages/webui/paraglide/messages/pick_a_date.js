/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Pick_A_DateInputs */

const en_pick_a_date = /** @type {(inputs: Pick_A_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Pick a date`)
}

const zh_pick_a_date = /** @type {(inputs: Pick_A_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择日期`)
}

/**
 * | output |
 * | --- |
 * | "Pick a date" |
 *
 * @param {Pick_A_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const pick_a_date =
  /** @type {((inputs?: Pick_A_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Pick_A_DateInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_pick_a_date(inputs)
      return zh_pick_a_date(inputs)
    }
  )
