/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Language_UpdatedInputs */

const en_language_updated =
  /** @type {(inputs: Language_UpdatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Language updated successfully`)
  }

const zh_language_updated =
  /** @type {(inputs: Language_UpdatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`语言更新成功`)
  }

/**
 * | output |
 * | --- |
 * | "Language updated successfully" |
 *
 * @param {Language_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const language_updated =
  /** @type {((inputs?: Language_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Language_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_language_updated(inputs)
      return zh_language_updated(inputs)
    }
  )
