/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_Link_RenamedInputs */

const en_share_link_renamed =
  /** @type {(inputs: Share_Link_RenamedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Share link renamed`)
  }

const zh_share_link_renamed =
  /** @type {(inputs: Share_Link_RenamedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`分享链接已重命名`)
  }

/**
 * | output |
 * | --- |
 * | "Share link renamed" |
 *
 * @param {Share_Link_RenamedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_link_renamed =
  /** @type {((inputs?: Share_Link_RenamedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_Link_RenamedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_share_link_renamed(inputs)
      return zh_share_link_renamed(inputs)
    }
  )
