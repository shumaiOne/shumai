/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Your_UploadsInputs */

const en_your_uploads = /** @type {(inputs: Your_UploadsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Your Uploads`)
}

const zh_your_uploads = /** @type {(inputs: Your_UploadsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`你的上传`)
}

/**
 * | output |
 * | --- |
 * | "Your Uploads" |
 *
 * @param {Your_UploadsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const your_uploads =
  /** @type {((inputs?: Your_UploadsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Your_UploadsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_your_uploads(inputs)
      return zh_your_uploads(inputs)
    }
  )
