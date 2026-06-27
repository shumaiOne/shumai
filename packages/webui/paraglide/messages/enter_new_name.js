/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_New_NameInputs */

const en_enter_new_name = /** @type {(inputs: Enter_New_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Enter new name`)
}

const zh_enter_new_name = /** @type {(inputs: Enter_New_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`输入新名称`)
}

/**
 * | output |
 * | --- |
 * | "Enter new name" |
 *
 * @param {Enter_New_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_new_name =
  /** @type {((inputs?: Enter_New_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_New_NameInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_enter_new_name(inputs)
      return zh_enter_new_name(inputs)
    }
  )
