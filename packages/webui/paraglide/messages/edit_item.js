/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Edit_ItemInputs */

const en_edit_item = /** @type {(inputs: Edit_ItemInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`Edit ${i?.name}`)
}

const zh_edit_item = /** @type {(inputs: Edit_ItemInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`编辑 ${i?.name}`)
}

/**
 * | output |
 * | --- |
 * | "Edit {name}" |
 *
 * @param {Edit_ItemInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const edit_item =
  /** @type {((inputs: Edit_ItemInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Edit_ItemInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_edit_item(inputs)
      return zh_edit_item(inputs)
    }
  )
