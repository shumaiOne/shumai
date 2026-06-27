/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Team_AttributesInputs */

const en_team_attributes = /** @type {(inputs: Team_AttributesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Team Attributes`)
}

const zh_team_attributes = /** @type {(inputs: Team_AttributesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`团队属性`)
}

/**
 * | output |
 * | --- |
 * | "Team Attributes" |
 *
 * @param {Team_AttributesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const team_attributes =
  /** @type {((inputs?: Team_AttributesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Team_AttributesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_team_attributes(inputs)
      return zh_team_attributes(inputs)
    }
  )
