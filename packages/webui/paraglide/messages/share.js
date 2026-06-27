/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ShareInputs */

const en_share = /** @type {(inputs: ShareInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Share`)
}

const zh_share = /** @type {(inputs: ShareInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`分享`)
}

/**
 * | output |
 * | --- |
 * | "Share" |
 *
 * @param {ShareInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const share =
  /** @type {((inputs?: ShareInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ShareInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_share(inputs)
      return zh_share(inputs)
    }
  )
