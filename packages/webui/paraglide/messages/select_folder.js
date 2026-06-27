/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_FolderInputs */

const en_select_folder = /** @type {(inputs: Select_FolderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select Folder`)
}

const zh_select_folder = /** @type {(inputs: Select_FolderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择文件夹`)
}

/**
 * | output |
 * | --- |
 * | "Select Folder" |
 *
 * @param {Select_FolderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_folder =
  /** @type {((inputs?: Select_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_FolderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_folder(inputs)
      return zh_select_folder(inputs)
    }
  )
