/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_A_TeamInputs */

const en_select_a_team = /** @type {(inputs: Select_A_TeamInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select a Team`)
}

const zh_select_a_team = /** @type {(inputs: Select_A_TeamInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择团队`)
}

/**
 * | output |
 * | --- |
 * | "Select a Team" |
 *
 * @param {Select_A_TeamInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_a_team =
  /** @type {((inputs?: Select_A_TeamInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_A_TeamInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_a_team(inputs)
      return zh_select_a_team(inputs)
    }
  )
