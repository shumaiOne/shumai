/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Name_PlaceholderInputs */

const en_field_name_placeholder =
  /** @type {(inputs: Field_Name_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`e.g. Status`)
  }

const zh_field_name_placeholder =
  /** @type {(inputs: Field_Name_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`例如：状态`)
  }

/**
 * | output |
 * | --- |
 * | "e.g. Status" |
 *
 * @param {Field_Name_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const field_name_placeholder =
  /** @type {((inputs?: Field_Name_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Name_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_field_name_placeholder(inputs)
      return zh_field_name_placeholder(inputs)
    }
  )
