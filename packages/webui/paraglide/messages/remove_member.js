/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Remove_MemberInputs */

const en_remove_member = /** @type {(inputs: Remove_MemberInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Remove Member`)
}

const zh_remove_member = /** @type {(inputs: Remove_MemberInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`移除成员`)
}

/**
 * | output |
 * | --- |
 * | "Remove Member" |
 *
 * @param {Remove_MemberInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const remove_member =
  /** @type {((inputs?: Remove_MemberInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Remove_MemberInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_remove_member(inputs)
      return zh_remove_member(inputs)
    }
  )
