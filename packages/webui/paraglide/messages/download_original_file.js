/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Download_Original_FileInputs */

const en_download_original_file =
  /** @type {(inputs: Download_Original_FileInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Download original file`)
  }

const zh_download_original_file =
  /** @type {(inputs: Download_Original_FileInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`下载原始文件`)
  }

/**
 * | output |
 * | --- |
 * | "Download original file" |
 *
 * @param {Download_Original_FileInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const download_original_file =
  /** @type {((inputs?: Download_Original_FileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Download_Original_FileInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_download_original_file(inputs)
      return zh_download_original_file(inputs)
    }
  )
