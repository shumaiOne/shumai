/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_Link_CreatedInputs */

const en_share_link_created =
  /** @type {(inputs: Share_Link_CreatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Share link created`)
  }

const zh_share_link_created =
  /** @type {(inputs: Share_Link_CreatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`分享链接已创建`)
  }

/**
 * | output |
 * | --- |
 * | "Share link created" |
 *
 * @param {Share_Link_CreatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_link_created =
  /** @type {((inputs?: Share_Link_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_Link_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_share_link_created(inputs)
      return zh_share_link_created(inputs)
    }
  )
