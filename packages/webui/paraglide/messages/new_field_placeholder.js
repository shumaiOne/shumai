/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_Field_PlaceholderInputs */

const en_new_field_placeholder =
  /** @type {(inputs: New_Field_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`New Field`)
  }

const zh_new_field_placeholder =
  /** @type {(inputs: New_Field_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`新字段`)
  }

/**
 * | output |
 * | --- |
 * | "New Field" |
 *
 * @param {New_Field_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const new_field_placeholder =
  /** @type {((inputs?: New_Field_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_Field_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_new_field_placeholder(inputs)
      return zh_new_field_placeholder(inputs)
    }
  )
