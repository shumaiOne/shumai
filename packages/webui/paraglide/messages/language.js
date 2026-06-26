/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} LanguageInputs */

const en_language = /** @type {(inputs: LanguageInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Language`)
}

const zh_language = /** @type {(inputs: LanguageInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`语言`)
}

/**
 * | output |
 * | --- |
 * | "Language" |
 *
 * @param {LanguageInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const language =
  /** @type {((inputs?: LanguageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<LanguageInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_language(inputs)
      return zh_language(inputs)
    }
  )
