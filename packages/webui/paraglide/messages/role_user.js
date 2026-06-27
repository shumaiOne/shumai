/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Role_UserInputs */

const en_role_user = /** @type {(inputs: Role_UserInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`User`)
}

const zh_role_user = /** @type {(inputs: Role_UserInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`用户`)
}

/**
 * | output |
 * | --- |
 * | "User" |
 *
 * @param {Role_UserInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const role_user =
  /** @type {((inputs?: Role_UserInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Role_UserInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_role_user(inputs)
      return zh_role_user(inputs)
    }
  )
