/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Download_Includes_FilesInputs */

const en_download_includes_files =
  /** @type {(inputs: Download_Includes_FilesInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`This download will include ${i?.count} file(s).`)
  }

const zh_download_includes_files =
  /** @type {(inputs: Download_Includes_FilesInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`此下载将包含 ${i?.count} 个文件。`)
  }

/**
 * | output |
 * | --- |
 * | "This download will include {count} file(s)." |
 *
 * @param {Download_Includes_FilesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const download_includes_files =
  /** @type {((inputs: Download_Includes_FilesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Download_Includes_FilesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_download_includes_files(inputs)
      return zh_download_includes_files(inputs)
    }
  )
