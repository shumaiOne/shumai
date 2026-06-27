/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DownloadInputs */

const en_download = /** @type {(inputs: DownloadInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Download`)
}

const zh_download = /** @type {(inputs: DownloadInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`下载`)
}

/**
 * | output |
 * | --- |
 * | "Download" |
 *
 * @param {DownloadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const download =
  /** @type {((inputs?: DownloadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DownloadInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_download(inputs)
      return zh_download(inputs)
    }
  )
