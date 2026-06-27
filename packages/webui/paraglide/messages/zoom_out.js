/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Zoom_OutInputs */

const en_zoom_out = /** @type {(inputs: Zoom_OutInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Zoom Out`)
}

const zh_zoom_out = /** @type {(inputs: Zoom_OutInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`缩小`)
}

/**
 * | output |
 * | --- |
 * | "Zoom Out" |
 *
 * @param {Zoom_OutInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const zoom_out =
  /** @type {((inputs?: Zoom_OutInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Zoom_OutInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_zoom_out(inputs)
      return zh_zoom_out(inputs)
    }
  )
