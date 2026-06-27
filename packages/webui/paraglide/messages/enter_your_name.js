/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_Your_NameInputs */

const en_enter_your_name = /** @type {(inputs: Enter_Your_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Enter your name`)
}

const zh_enter_your_name = /** @type {(inputs: Enter_Your_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`请输入您的名称`)
}

/**
 * | output |
 * | --- |
 * | "Enter your name" |
 *
 * @param {Enter_Your_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_your_name =
  /** @type {((inputs?: Enter_Your_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_Your_NameInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_enter_your_name(inputs)
      return zh_enter_your_name(inputs)
    }
  )
