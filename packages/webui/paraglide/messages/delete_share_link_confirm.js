/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Share_Link_ConfirmInputs */

const en_delete_share_link_confirm =
  /** @type {(inputs: Delete_Share_Link_ConfirmInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Delete Share Link?`)
  }

const zh_delete_share_link_confirm =
  /** @type {(inputs: Delete_Share_Link_ConfirmInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`删除分享链接？`)
  }

/**
 * | output |
 * | --- |
 * | "Delete Share Link?" |
 *
 * @param {Delete_Share_Link_ConfirmInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_share_link_confirm =
  /** @type {((inputs?: Delete_Share_Link_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Share_Link_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_delete_share_link_confirm(inputs)
      return zh_delete_share_link_confirm(inputs)
    }
  )
