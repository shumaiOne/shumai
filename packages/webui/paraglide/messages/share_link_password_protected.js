/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_Link_Password_ProtectedInputs */

const en_share_link_password_protected =
  /** @type {(inputs: Share_Link_Password_ProtectedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`This share link is password protected.`)
  }

const zh_share_link_password_protected =
  /** @type {(inputs: Share_Link_Password_ProtectedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`此分享链接受密码保护。`)
  }

/**
 * | output |
 * | --- |
 * | "This share link is password protected." |
 *
 * @param {Share_Link_Password_ProtectedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_link_password_protected =
  /** @type {((inputs?: Share_Link_Password_ProtectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_Link_Password_ProtectedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_share_link_password_protected(inputs)
      return zh_share_link_password_protected(inputs)
    }
  )
