/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} First_User_NoticeInputs */

const en_first_user_notice =
  /** @type {(inputs: First_User_NoticeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `You will be the owner of the default workspace as the first user!`
    )
  }

const zh_first_user_notice =
  /** @type {(inputs: First_User_NoticeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`作为第一位用户，您将成为默认工作空间的拥有者！`)
  }

/**
 * | output |
 * | --- |
 * | "You will be the owner of the default workspace as the first user!" |
 *
 * @param {First_User_NoticeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const first_user_notice =
  /** @type {((inputs?: First_User_NoticeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<First_User_NoticeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_first_user_notice(inputs)
      return zh_first_user_notice(inputs)
    }
  )
