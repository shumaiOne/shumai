/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_Items_SelectedInputs */

const en_n_items_selected = /** @type {(inputs: N_Items_SelectedInputs) => LocalizedString} */ (
  i,
) => {
  return /** @type {LocalizedString} */ (`${i?.count} Item(s) selected`)
}

const zh_n_items_selected = /** @type {(inputs: N_Items_SelectedInputs) => LocalizedString} */ (
  i,
) => {
  return /** @type {LocalizedString} */ (`已选择 ${i?.count} 个项目`)
}

/**
 * | output |
 * | --- |
 * | "{count} Item(s) selected" |
 *
 * @param {N_Items_SelectedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const n_items_selected =
  /** @type {((inputs: N_Items_SelectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_Items_SelectedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_n_items_selected(inputs)
      return zh_n_items_selected(inputs)
    }
  )
