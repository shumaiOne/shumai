/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Are_You_Absolutely_SureInputs */

const en_are_you_absolutely_sure =
  /** @type {(inputs: Are_You_Absolutely_SureInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Are you absolutely sure?`)
  }

const zh_are_you_absolutely_sure =
  /** @type {(inputs: Are_You_Absolutely_SureInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`你确定要这样做吗？`)
  }

/**
 * | output |
 * | --- |
 * | "Are you absolutely sure?" |
 *
 * @param {Are_You_Absolutely_SureInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const are_you_absolutely_sure =
  /** @type {((inputs?: Are_You_Absolutely_SureInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Are_You_Absolutely_SureInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_are_you_absolutely_sure(inputs)
      return zh_are_you_absolutely_sure(inputs)
    }
  )
