/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Share_Links_YetInputs */

const en_no_share_links_yet =
  /** @type {(inputs: No_Share_Links_YetInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`No share links created yet.`)
  }

const zh_no_share_links_yet =
  /** @type {(inputs: No_Share_Links_YetInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`暂无分享链接。`)
  }

/**
 * | output |
 * | --- |
 * | "No share links created yet." |
 *
 * @param {No_Share_Links_YetInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_share_links_yet =
  /** @type {((inputs?: No_Share_Links_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Share_Links_YetInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_share_links_yet(inputs)
      return zh_no_share_links_yet(inputs)
    }
  )
