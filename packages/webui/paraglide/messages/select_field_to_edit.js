/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Field_To_EditInputs */

const en_select_field_to_edit =
  /** @type {(inputs: Select_Field_To_EditInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Select a field to edit options`)
  }

const zh_select_field_to_edit =
  /** @type {(inputs: Select_Field_To_EditInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`选择一个字段以编辑选项`)
  }

/**
 * | output |
 * | --- |
 * | "Select a field to edit options" |
 *
 * @param {Select_Field_To_EditInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_field_to_edit =
  /** @type {((inputs?: Select_Field_To_EditInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Field_To_EditInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_field_to_edit(inputs)
      return zh_select_field_to_edit(inputs)
    }
  )
