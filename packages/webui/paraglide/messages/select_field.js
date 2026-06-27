/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_FieldInputs */

const en_select_field = /** @type {(inputs: Select_FieldInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select field`)
}

const zh_select_field = /** @type {(inputs: Select_FieldInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择字段`)
}

/**
 * | output |
 * | --- |
 * | "Select field" |
 *
 * @param {Select_FieldInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_field =
  /** @type {((inputs?: Select_FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_FieldInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_field(inputs)
      return zh_select_field(inputs)
    }
  )
