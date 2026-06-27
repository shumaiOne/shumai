/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Field_TypeInputs */

const en_select_field_type =
  /** @type {(inputs: Select_Field_TypeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Select field type`)
  }

const zh_select_field_type =
  /** @type {(inputs: Select_Field_TypeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`选择字段类型`)
  }

/**
 * | output |
 * | --- |
 * | "Select field type" |
 *
 * @param {Select_Field_TypeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_field_type =
  /** @type {((inputs?: Select_Field_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Field_TypeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_field_type(inputs)
      return zh_select_field_type(inputs)
    }
  )
