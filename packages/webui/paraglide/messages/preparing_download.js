/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Preparing_DownloadInputs */

const en_preparing_download =
  /** @type {(inputs: Preparing_DownloadInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Preparing Download`)
  }

const zh_preparing_download =
  /** @type {(inputs: Preparing_DownloadInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`正在准备下载`)
  }

/**
 * | output |
 * | --- |
 * | "Preparing Download" |
 *
 * @param {Preparing_DownloadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const preparing_download =
  /** @type {((inputs?: Preparing_DownloadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Preparing_DownloadInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_preparing_download(inputs)
      return zh_preparing_download(inputs)
    }
  )
