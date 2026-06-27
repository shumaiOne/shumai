/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Processing_PackageInputs */

const en_processing_package =
  /** @type {(inputs: Processing_PackageInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Processing package...`)
  }

const zh_processing_package =
  /** @type {(inputs: Processing_PackageInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`正在处理包...`)
  }

/**
 * | output |
 * | --- |
 * | "Processing package..." |
 *
 * @param {Processing_PackageInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const processing_package =
  /** @type {((inputs?: Processing_PackageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Processing_PackageInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_processing_package(inputs)
      return zh_processing_package(inputs)
    }
  )
