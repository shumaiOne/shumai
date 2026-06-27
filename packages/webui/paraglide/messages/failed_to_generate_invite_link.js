/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Generate_Invite_LinkInputs */

const en_failed_to_generate_invite_link =
  /** @type {(inputs: Failed_To_Generate_Invite_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Failed to generate invite link`)
  }

const zh_failed_to_generate_invite_link =
  /** @type {(inputs: Failed_To_Generate_Invite_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`生成邀请链接失败`)
  }

/**
 * | output |
 * | --- |
 * | "Failed to generate invite link" |
 *
 * @param {Failed_To_Generate_Invite_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_generate_invite_link =
  /** @type {((inputs?: Failed_To_Generate_Invite_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Generate_Invite_LinkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_to_generate_invite_link(inputs)
      return zh_failed_to_generate_invite_link(inputs)
    }
  )
