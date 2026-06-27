/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_LanguageInputs */

const en_select_language = /** @type {(inputs: Select_LanguageInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select Language`)
}

const zh_select_language = /** @type {(inputs: Select_LanguageInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择语言`)
}

/**
 * | output |
 * | --- |
 * | "Select Language" |
 *
 * @param {Select_LanguageInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_language =
  /** @type {((inputs?: Select_LanguageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_LanguageInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_language(inputs)
      return zh_select_language(inputs)
    }
  )
