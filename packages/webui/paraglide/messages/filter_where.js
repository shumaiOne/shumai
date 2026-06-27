/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filter_WhereInputs */

const en_filter_where = /** @type {(inputs: Filter_WhereInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Where`)
}

const zh_filter_where = /** @type {(inputs: Filter_WhereInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`条件`)
}

/**
 * | output |
 * | --- |
 * | "Where" |
 *
 * @param {Filter_WhereInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const filter_where =
  /** @type {((inputs?: Filter_WhereInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filter_WhereInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_filter_where(inputs)
      return zh_filter_where(inputs)
    }
  )
