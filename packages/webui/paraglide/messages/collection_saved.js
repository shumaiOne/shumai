/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Collection_SavedInputs */

const en_collection_saved =
  /** @type {(inputs: Collection_SavedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Collection saved`)
  }

const zh_collection_saved =
  /** @type {(inputs: Collection_SavedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`收藏集已保存`)
  }

/**
 * | output |
 * | --- |
 * | "Collection saved" |
 *
 * @param {Collection_SavedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const collection_saved =
  /** @type {((inputs?: Collection_SavedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Collection_SavedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_collection_saved(inputs)
      return zh_collection_saved(inputs)
    }
  )
