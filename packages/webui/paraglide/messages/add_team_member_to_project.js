/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Team_Member_To_ProjectInputs */

const en_add_team_member_to_project =
  /** @type {(inputs: Add_Team_Member_To_ProjectInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Add Team Member to Project`)
  }

const zh_add_team_member_to_project =
  /** @type {(inputs: Add_Team_Member_To_ProjectInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`将团队成员添加到项目`)
  }

/**
 * | output |
 * | --- |
 * | "Add Team Member to Project" |
 *
 * @param {Add_Team_Member_To_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_team_member_to_project =
  /** @type {((inputs?: Add_Team_Member_To_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Team_Member_To_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_add_team_member_to_project(inputs)
      return zh_add_team_member_to_project(inputs)
    }
  )
