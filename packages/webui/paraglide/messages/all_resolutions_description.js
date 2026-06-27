/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_Resolutions_DescriptionInputs */

const en_all_resolutions_description =
  /** @type {(inputs: All_Resolutions_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Generates all supported resolutions up to the source quality.`
    )
  }

const zh_all_resolutions_description =
  /** @type {(inputs: All_Resolutions_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`生成不超过源质量的所有支持分辨率。`)
  }

/**
 * | output |
 * | --- |
 * | "Generates all supported resolutions up to the source quality." |
 *
 * @param {All_Resolutions_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const all_resolutions_description =
  /** @type {((inputs?: All_Resolutions_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_Resolutions_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_all_resolutions_description(inputs)
      return zh_all_resolutions_description(inputs)
    }
  )
