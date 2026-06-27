/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Media_ProcessingInputs */

const en_media_processing =
  /** @type {(inputs: Media_ProcessingInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Media Processing`)
  }

const zh_media_processing =
  /** @type {(inputs: Media_ProcessingInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`媒体处理`)
  }

/**
 * | output |
 * | --- |
 * | "Media Processing" |
 *
 * @param {Media_ProcessingInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const media_processing =
  /** @type {((inputs?: Media_ProcessingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Media_ProcessingInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_media_processing(inputs)
      return zh_media_processing(inputs)
    }
  )
