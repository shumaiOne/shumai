/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SharesInputs */

const en_shares = /** @type {(inputs: SharesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Shares`)
}

const zh_shares = /** @type {(inputs: SharesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`分享`)
}

/**
 * | output |
 * | --- |
 * | "Shares" |
 *
 * @param {SharesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const shares =
  /** @type {((inputs?: SharesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SharesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_shares(inputs)
      return zh_shares(inputs)
    }
  )
