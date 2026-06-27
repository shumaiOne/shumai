/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_LinksInputs */

const en_share_links = /** @type {(inputs: Share_LinksInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Share Links`)
}

const zh_share_links = /** @type {(inputs: Share_LinksInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`分享链接`)
}

/**
 * | output |
 * | --- |
 * | "Share Links" |
 *
 * @param {Share_LinksInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_links =
  /** @type {((inputs?: Share_LinksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_LinksInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_share_links(inputs)
      return zh_share_links(inputs)
    }
  )
