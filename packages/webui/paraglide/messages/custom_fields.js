/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Custom_FieldsInputs */

const en_custom_fields = /** @type {(inputs: Custom_FieldsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Custom Fields`)
}

const zh_custom_fields = /** @type {(inputs: Custom_FieldsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`自定义字段`)
}

/**
 * | output |
 * | --- |
 * | "Custom Fields" |
 *
 * @param {Custom_FieldsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const custom_fields =
  /** @type {((inputs?: Custom_FieldsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Custom_FieldsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_custom_fields(inputs)
      return zh_custom_fields(inputs)
    }
  )
