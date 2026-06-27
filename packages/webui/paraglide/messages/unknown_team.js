/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unknown_TeamInputs */

const en_unknown_team = /** @type {(inputs: Unknown_TeamInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`unknown team`)
}

const zh_unknown_team = /** @type {(inputs: Unknown_TeamInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`未知团队`)
}

/**
 * | output |
 * | --- |
 * | "unknown team" |
 *
 * @param {Unknown_TeamInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const unknown_team =
  /** @type {((inputs?: Unknown_TeamInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unknown_TeamInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_unknown_team(inputs)
      return zh_unknown_team(inputs)
    }
  )
