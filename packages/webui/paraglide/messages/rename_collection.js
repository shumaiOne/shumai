/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Rename_CollectionInputs */

const en_rename_collection =
  /** @type {(inputs: Rename_CollectionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Rename Collection`)
  }

const zh_rename_collection =
  /** @type {(inputs: Rename_CollectionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`重命名收藏集`)
  }

/**
 * | output |
 * | --- |
 * | "Rename Collection" |
 *
 * @param {Rename_CollectionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const rename_collection =
  /** @type {((inputs?: Rename_CollectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Rename_CollectionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_rename_collection(inputs)
      return zh_rename_collection(inputs)
    }
  )
