/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_ExpiredInputs */

const en_share_expired = /** @type {(inputs: Share_ExpiredInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Share Expired`)
}

const zh_share_expired = /** @type {(inputs: Share_ExpiredInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`分享已过期`)
}

/**
 * | output |
 * | --- |
 * | "Share Expired" |
 *
 * @param {Share_ExpiredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share_expired =
  /** @type {((inputs?: Share_ExpiredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_ExpiredInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_share_expired(inputs)
      return zh_share_expired(inputs)
    }
  )
