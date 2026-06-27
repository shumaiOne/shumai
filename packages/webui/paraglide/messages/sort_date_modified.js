/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sort_Date_ModifiedInputs */

const en_sort_date_modified =
  /** @type {(inputs: Sort_Date_ModifiedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Date Modified`)
  }

const zh_sort_date_modified =
  /** @type {(inputs: Sort_Date_ModifiedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`修改日期`)
  }

/**
 * | output |
 * | --- |
 * | "Date Modified" |
 *
 * @param {Sort_Date_ModifiedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_date_modified =
  /** @type {((inputs?: Sort_Date_ModifiedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sort_Date_ModifiedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sort_date_modified(inputs)
      return zh_sort_date_modified(inputs)
    }
  )
