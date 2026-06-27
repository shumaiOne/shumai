/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Collections_YetInputs */

const en_no_collections_yet =
  /** @type {(inputs: No_Collections_YetInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`No collections created yet.`)
  }

const zh_no_collections_yet =
  /** @type {(inputs: No_Collections_YetInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`暂无收藏集。`)
  }

/**
 * | output |
 * | --- |
 * | "No collections created yet." |
 *
 * @param {No_Collections_YetInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_collections_yet =
  /** @type {((inputs?: No_Collections_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Collections_YetInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_collections_yet(inputs)
      return zh_no_collections_yet(inputs)
    }
  )
