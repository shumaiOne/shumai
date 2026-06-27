/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_ConditionInputs */

const en_add_condition = /** @type {(inputs: Add_ConditionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`+ Add condition`)
}

const zh_add_condition = /** @type {(inputs: Add_ConditionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`+ 添加条件`)
}

/**
 * | output |
 * | --- |
 * | "+ Add condition" |
 *
 * @param {Add_ConditionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_condition =
  /** @type {((inputs?: Add_ConditionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_ConditionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_add_condition(inputs)
      return zh_add_condition(inputs)
    }
  )
