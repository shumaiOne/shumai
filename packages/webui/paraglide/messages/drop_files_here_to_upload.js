/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Drop_Files_Here_To_UploadInputs */

const en_drop_files_here_to_upload =
  /** @type {(inputs: Drop_Files_Here_To_UploadInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Drop files here to upload`)
  }

const zh_drop_files_here_to_upload =
  /** @type {(inputs: Drop_Files_Here_To_UploadInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`将文件拖放到此处上传`)
  }

/**
 * | output |
 * | --- |
 * | "Drop files here to upload" |
 *
 * @param {Drop_Files_Here_To_UploadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const drop_files_here_to_upload =
  /** @type {((inputs?: Drop_Files_Here_To_UploadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Drop_Files_Here_To_UploadInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_drop_files_here_to_upload(inputs)
      return zh_drop_files_here_to_upload(inputs)
    }
  )
