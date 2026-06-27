/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Team_DescriptionInputs */

const en_select_team_description =
  /** @type {(inputs: Select_Team_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `You are a member of multiple teams. Please select one to continue.`
    )
  }

const zh_select_team_description =
  /** @type {(inputs: Select_Team_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`您是多个团队的成员，请选择一个以继续。`)
  }

/**
 * | output |
 * | --- |
 * | "You are a member of multiple teams. Please select one to continue." |
 *
 * @param {Select_Team_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_team_description =
  /** @type {((inputs?: Select_Team_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Team_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_team_description(inputs)
      return zh_select_team_description(inputs)
    }
  )
