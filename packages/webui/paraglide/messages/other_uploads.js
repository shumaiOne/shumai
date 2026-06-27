/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Other_UploadsInputs */

const en_other_uploads = /** @type {(inputs: Other_UploadsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Other Uploads`)
}

const zh_other_uploads = /** @type {(inputs: Other_UploadsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`其他上传`)
}

/**
 * | output |
 * | --- |
 * | "Other Uploads" |
 *
 * @param {Other_UploadsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const other_uploads =
  /** @type {((inputs?: Other_UploadsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Other_UploadsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_other_uploads(inputs)
      return zh_other_uploads(inputs)
    }
  )
