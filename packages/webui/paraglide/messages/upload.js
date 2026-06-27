/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} UploadInputs */

const en_upload = /** @type {(inputs: UploadInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Upload`)
}

const zh_upload = /** @type {(inputs: UploadInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`上传`)
}

/**
 * | output |
 * | --- |
 * | "Upload" |
 *
 * @param {UploadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const upload =
  /** @type {((inputs?: UploadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<UploadInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_upload(inputs)
      return zh_upload(inputs)
    }
  )
