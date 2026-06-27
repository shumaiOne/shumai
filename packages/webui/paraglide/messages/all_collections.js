/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_CollectionsInputs */

const en_all_collections = /** @type {(inputs: All_CollectionsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`All Collections`)
}

const zh_all_collections = /** @type {(inputs: All_CollectionsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`所有收藏集`)
}

/**
 * | output |
 * | --- |
 * | "All Collections" |
 *
 * @param {All_CollectionsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const all_collections =
  /** @type {((inputs?: All_CollectionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_CollectionsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_all_collections(inputs)
      return zh_all_collections(inputs)
    }
  )
