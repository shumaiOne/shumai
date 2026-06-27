/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ field: NonNullable<unknown> }} Sorted_ByInputs */

const en_sorted_by = /** @type {(inputs: Sorted_ByInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`Sorted by ${i?.field}`)
}

const zh_sorted_by = /** @type {(inputs: Sorted_ByInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`按${i?.field}排序`)
}

/**
 * | output |
 * | --- |
 * | "Sorted by {field}" |
 *
 * @param {Sorted_ByInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sorted_by =
  /** @type {((inputs: Sorted_ByInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sorted_ByInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sorted_by(inputs)
      return zh_sorted_by(inputs)
    }
  )
