/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Open_Share_LinkInputs */

const en_open_share_link = /** @type {(inputs: Open_Share_LinkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Open Share Link`)
}

const zh_open_share_link = /** @type {(inputs: Open_Share_LinkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`打开分享链接`)
}

/**
 * | output |
 * | --- |
 * | "Open Share Link" |
 *
 * @param {Open_Share_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const open_share_link =
  /** @type {((inputs?: Open_Share_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Open_Share_LinkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_open_share_link(inputs)
      return zh_open_share_link(inputs)
    }
  )
