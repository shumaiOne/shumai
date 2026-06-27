/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Folder_DeletedInputs */

const en_folder_deleted = /** @type {(inputs: Folder_DeletedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Folder deleted`)
}

const zh_folder_deleted = /** @type {(inputs: Folder_DeletedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`文件夹已删除`)
}

/**
 * | output |
 * | --- |
 * | "Folder deleted" |
 *
 * @param {Folder_DeletedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const folder_deleted =
  /** @type {((inputs?: Folder_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folder_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_folder_deleted(inputs)
      return zh_folder_deleted(inputs)
    }
  )
