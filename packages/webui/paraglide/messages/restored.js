/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} RestoredInputs */

const en_restored = /** @type {(inputs: RestoredInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Restored`)
}

const zh_restored = /** @type {(inputs: RestoredInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`已恢复`)
}

/**
 * | output |
 * | --- |
 * | "Restored" |
 *
 * @param {RestoredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const restored =
  /** @type {((inputs?: RestoredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<RestoredInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_restored(inputs)
      return zh_restored(inputs)
    }
  )
