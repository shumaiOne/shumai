/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Collection_DeletedInputs */

const en_collection_deleted =
  /** @type {(inputs: Collection_DeletedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Collection deleted`)
  }

const zh_collection_deleted =
  /** @type {(inputs: Collection_DeletedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`收藏集已删除`)
  }

/**
 * | output |
 * | --- |
 * | "Collection deleted" |
 *
 * @param {Collection_DeletedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const collection_deleted =
  /** @type {((inputs?: Collection_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Collection_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_collection_deleted(inputs)
      return zh_collection_deleted(inputs)
    }
  )
