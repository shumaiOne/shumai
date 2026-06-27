/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_A_To_ZInputs */

const en_sort_a_to_z = /** @type {(inputs: Sort_A_To_ZInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`A → Z`)
}

const zh_sort_a_to_z = /** @type {(inputs: Sort_A_To_ZInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`A → Z`)
}

/**
 * | output |
 * | --- |
 * | "A → Z" |
 *
 * @param {Sort_A_To_ZInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_a_to_z =
  /** @type {((inputs?: Sort_A_To_ZInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_A_To_ZInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sort_a_to_z(inputs)
      return zh_sort_a_to_z(inputs)
    }
  )
