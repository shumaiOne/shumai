/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_Not_AvailableInputs */

const en_media_not_available =
  /** @type {(inputs: Media_Not_AvailableInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Media is not available.`)
  }

const zh_media_not_available =
  /** @type {(inputs: Media_Not_AvailableInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`媒体不可用。`)
  }

/**
 * | output |
 * | --- |
 * | "Media is not available." |
 *
 * @param {Media_Not_AvailableInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const media_not_available =
  /** @type {((inputs?: Media_Not_AvailableInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_Not_AvailableInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_media_not_available(inputs)
      return zh_media_not_available(inputs)
    }
  )
