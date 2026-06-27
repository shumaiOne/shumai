/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Folder_CreatedInputs */

const en_folder_created = /** @type {(inputs: Folder_CreatedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Folder created`)
}

const zh_folder_created = /** @type {(inputs: Folder_CreatedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`文件夹已创建`)
}

/**
 * | output |
 * | --- |
 * | "Folder created" |
 *
 * @param {Folder_CreatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const folder_created =
  /** @type {((inputs?: Folder_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folder_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_folder_created(inputs)
      return zh_folder_created(inputs)
    }
  )
