/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Download_Original_ImageInputs */

const en_download_original_image =
  /** @type {(inputs: Download_Original_ImageInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Download original image`)
  }

const zh_download_original_image =
  /** @type {(inputs: Download_Original_ImageInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`下载原始图片`)
  }

/**
 * | output |
 * | --- |
 * | "Download original image" |
 *
 * @param {Download_Original_ImageInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const download_original_image =
  /** @type {((inputs?: Download_Original_ImageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Download_Original_ImageInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_download_original_image(inputs)
      return zh_download_original_image(inputs)
    }
  )
