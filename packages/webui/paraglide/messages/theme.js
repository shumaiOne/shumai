/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ThemeInputs */

const en_theme = /** @type {(inputs: ThemeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Theme`)
}

const zh_theme = /** @type {(inputs: ThemeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`主题`)
}

/**
 * | output |
 * | --- |
 * | "Theme" |
 *
 * @param {ThemeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const theme =
  /** @type {((inputs?: ThemeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ThemeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_theme(inputs)
      return zh_theme(inputs)
    }
  )
