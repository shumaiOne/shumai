/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SystemInputs */

const en_system = /** @type {(inputs: SystemInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`System`)
}

const zh_system = /** @type {(inputs: SystemInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`跟随系统`)
}

/**
 * | output |
 * | --- |
 * | "System" |
 *
 * @param {SystemInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const system =
  /** @type {((inputs?: SystemInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SystemInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_system(inputs)
      return zh_system(inputs)
    }
  )
