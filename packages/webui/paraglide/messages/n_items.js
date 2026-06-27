/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} N_ItemsInputs */

const en_n_items = /** @type {(inputs: N_ItemsInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`${i?.count} Items`)
}

const zh_n_items = /** @type {(inputs: N_ItemsInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`${i?.count} 个项目`)
}

/**
 * | output |
 * | --- |
 * | "{count} Items" |
 *
 * @param {N_ItemsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const n_items =
  /** @type {((inputs: N_ItemsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<N_ItemsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_n_items(inputs)
      return zh_n_items(inputs)
    }
  )
