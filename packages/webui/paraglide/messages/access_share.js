/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Access_ShareInputs */

const en_access_share = /** @type {(inputs: Access_ShareInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Access Share`)
}

const zh_access_share = /** @type {(inputs: Access_ShareInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`访问分享`)
}

/**
 * | output |
 * | --- |
 * | "Access Share" |
 *
 * @param {Access_ShareInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const access_share =
  /** @type {((inputs?: Access_ShareInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Access_ShareInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_access_share(inputs)
      return zh_access_share(inputs)
    }
  )
