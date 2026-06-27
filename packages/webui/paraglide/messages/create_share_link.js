/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_Share_LinkInputs */

const en_create_share_link =
  /** @type {(inputs: Create_Share_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Create Share Link`)
  }

const zh_create_share_link =
  /** @type {(inputs: Create_Share_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`创建分享链接`)
  }

/**
 * | output |
 * | --- |
 * | "Create Share Link" |
 *
 * @param {Create_Share_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const create_share_link =
  /** @type {((inputs?: Create_Share_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_Share_LinkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_create_share_link(inputs)
      return zh_create_share_link(inputs)
    }
  )
