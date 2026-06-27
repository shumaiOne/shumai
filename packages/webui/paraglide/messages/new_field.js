/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_FieldInputs */

const en_new_field = /** @type {(inputs: New_FieldInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`New Field`)
}

const zh_new_field = /** @type {(inputs: New_FieldInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`新建字段`)
}

/**
 * | output |
 * | --- |
 * | "New Field" |
 *
 * @param {New_FieldInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const new_field =
  /** @type {((inputs?: New_FieldInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_FieldInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_new_field(inputs)
      return zh_new_field(inputs)
    }
  )
