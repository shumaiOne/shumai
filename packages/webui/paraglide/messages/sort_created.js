/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_CreatedInputs */

const en_sort_created = /** @type {(inputs: Sort_CreatedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Created`)
}

const zh_sort_created = /** @type {(inputs: Sort_CreatedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`创建时间`)
}

/**
 * | output |
 * | --- |
 * | "Created" |
 *
 * @param {Sort_CreatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_created =
  /** @type {((inputs?: Sort_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sort_created(inputs)
      return zh_sort_created(inputs)
    }
  )
