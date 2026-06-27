/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_TeamInputs */

const en_create_team = /** @type {(inputs: Create_TeamInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Create Team`)
}

const zh_create_team = /** @type {(inputs: Create_TeamInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`创建团队`)
}

/**
 * | output |
 * | --- |
 * | "Create Team" |
 *
 * @param {Create_TeamInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const create_team =
  /** @type {((inputs?: Create_TeamInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_TeamInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_create_team(inputs)
      return zh_create_team(inputs)
    }
  )
