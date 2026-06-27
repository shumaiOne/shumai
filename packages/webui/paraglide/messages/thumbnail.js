/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ThumbnailInputs */

const en_thumbnail = /** @type {(inputs: ThumbnailInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Thumbnail`)
}

const zh_thumbnail = /** @type {(inputs: ThumbnailInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`缩略图`)
}

/**
 * | output |
 * | --- |
 * | "Thumbnail" |
 *
 * @param {ThumbnailInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thumbnail =
  /** @type {((inputs?: ThumbnailInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ThumbnailInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_thumbnail(inputs)
      return zh_thumbnail(inputs)
    }
  )
