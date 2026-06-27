/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Removed_From_ShareInputs */

const en_removed_from_share =
  /** @type {(inputs: Removed_From_ShareInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Removed from share`)
  }

const zh_removed_from_share =
  /** @type {(inputs: Removed_From_ShareInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`已从分享中移除`)
  }

/**
 * | output |
 * | --- |
 * | "Removed from share" |
 *
 * @param {Removed_From_ShareInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const removed_from_share =
  /** @type {((inputs?: Removed_From_ShareInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Removed_From_ShareInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_removed_from_share(inputs)
      return zh_removed_from_share(inputs)
    }
  )
