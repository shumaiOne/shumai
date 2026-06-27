/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_Link_DeletedInputs */

const en_share_link_deleted =
  /** @type {(inputs: Share_Link_DeletedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Share link deleted`)
  }

const zh_share_link_deleted =
  /** @type {(inputs: Share_Link_DeletedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`分享链接已删除`)
  }

/**
 * | output |
 * | --- |
 * | "Share link deleted" |
 *
 * @param {Share_Link_DeletedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_link_deleted =
  /** @type {((inputs?: Share_Link_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_Link_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_share_link_deleted(inputs)
      return zh_share_link_deleted(inputs)
    }
  )
