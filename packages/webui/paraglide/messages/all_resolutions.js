/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_ResolutionsInputs */

const en_all_resolutions = /** @type {(inputs: All_ResolutionsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`All resolutions`)
}

const zh_all_resolutions = /** @type {(inputs: All_ResolutionsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`所有分辨率`)
}

/**
 * | output |
 * | --- |
 * | "All resolutions" |
 *
 * @param {All_ResolutionsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const all_resolutions =
  /** @type {((inputs?: All_ResolutionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_ResolutionsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_all_resolutions(inputs)
      return zh_all_resolutions(inputs)
    }
  )
