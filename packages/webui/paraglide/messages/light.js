/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} LightInputs */

const en_light = /** @type {(inputs: LightInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Light`)
}

const zh_light = /** @type {(inputs: LightInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`浅色`)
}

/**
 * | output |
 * | --- |
 * | "Light" |
 *
 * @param {LightInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const light =
  /** @type {((inputs?: LightInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<LightInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_light(inputs)
      return zh_light(inputs)
    }
  )
