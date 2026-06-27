/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ChineseInputs */

const en_chinese = /** @type {(inputs: ChineseInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`简体中文 (Chinese)`)
}

const zh_chinese = /** @type {(inputs: ChineseInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`简体中文 (Chinese)`)
}

/**
 * | output |
 * | --- |
 * | "简体中文 (Chinese)" |
 *
 * @param {ChineseInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const chinese =
  /** @type {((inputs?: ChineseInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ChineseInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_chinese(inputs)
      return zh_chinese(inputs)
    }
  )
