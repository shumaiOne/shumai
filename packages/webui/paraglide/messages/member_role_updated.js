/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Member_Role_UpdatedInputs */

const en_member_role_updated =
  /** @type {(inputs: Member_Role_UpdatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Member role updated`)
  }

const zh_member_role_updated =
  /** @type {(inputs: Member_Role_UpdatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`成员角色已更新`)
  }

/**
 * | output |
 * | --- |
 * | "Member role updated" |
 *
 * @param {Member_Role_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const member_role_updated =
  /** @type {((inputs?: Member_Role_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Member_Role_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_member_role_updated(inputs)
      return zh_member_role_updated(inputs)
    }
  )
