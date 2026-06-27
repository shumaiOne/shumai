/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_FilesInputs */

const en_all_files = /** @type {(inputs: All_FilesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`All Files`)
}

const zh_all_files = /** @type {(inputs: All_FilesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`全部文件`)
}

/**
 * | output |
 * | --- |
 * | "All Files" |
 *
 * @param {All_FilesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const all_files =
  /** @type {((inputs?: All_FilesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_FilesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_all_files(inputs)
      return zh_all_files(inputs)
    }
  )
