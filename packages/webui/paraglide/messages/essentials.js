/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} EssentialsInputs */

const en_essentials = /** @type {(inputs: EssentialsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Essentials`)
}

const zh_essentials = /** @type {(inputs: EssentialsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`基本信息`)
}

/**
 * | output |
 * | --- |
 * | "Essentials" |
 *
 * @param {EssentialsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const essentials =
  /** @type {((inputs?: EssentialsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<EssentialsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_essentials(inputs)
      return zh_essentials(inputs)
    }
  )
