/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Create_CollectionInputs */

const en_failed_create_collection =
  /** @type {(inputs: Failed_Create_CollectionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Failed to create collection`)
  }

const zh_failed_create_collection =
  /** @type {(inputs: Failed_Create_CollectionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`创建收藏集失败`)
  }

/**
 * | output |
 * | --- |
 * | "Failed to create collection" |
 *
 * @param {Failed_Create_CollectionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_create_collection =
  /** @type {((inputs?: Failed_Create_CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Create_CollectionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_create_collection(inputs)
      return zh_failed_create_collection(inputs)
    }
  )
