/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_Some_TextInputs */

const en_enter_some_text = /** @type {(inputs: Enter_Some_TextInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Enter some text...`)
}

const zh_enter_some_text = /** @type {(inputs: Enter_Some_TextInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`输入一些文字...`)
}

/**
 * | output |
 * | --- |
 * | "Enter some text..." |
 *
 * @param {Enter_Some_TextInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_some_text =
  /** @type {((inputs?: Enter_Some_TextInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_Some_TextInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_enter_some_text(inputs)
      return zh_enter_some_text(inputs)
    }
  )
