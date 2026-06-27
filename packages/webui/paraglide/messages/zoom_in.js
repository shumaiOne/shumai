/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Zoom_InInputs */

const en_zoom_in = /** @type {(inputs: Zoom_InInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Zoom In`)
}

const zh_zoom_in = /** @type {(inputs: Zoom_InInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`放大`)
}

/**
 * | output |
 * | --- |
 * | "Zoom In" |
 *
 * @param {Zoom_InInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const zoom_in =
  /** @type {((inputs?: Zoom_InInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Zoom_InInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_zoom_in(inputs)
      return zh_zoom_in(inputs)
    }
  )
