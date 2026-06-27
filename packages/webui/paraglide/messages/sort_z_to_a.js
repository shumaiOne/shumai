/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_Z_To_AInputs */

const en_sort_z_to_a = /** @type {(inputs: Sort_Z_To_AInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Z → A`)
}

const zh_sort_z_to_a = /** @type {(inputs: Sort_Z_To_AInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Z → A`)
}

/**
 * | output |
 * | --- |
 * | "Z → A" |
 *
 * @param {Sort_Z_To_AInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_z_to_a =
  /** @type {((inputs?: Sort_Z_To_AInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_Z_To_AInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sort_z_to_a(inputs)
      return zh_sort_z_to_a(inputs)
    }
  )
