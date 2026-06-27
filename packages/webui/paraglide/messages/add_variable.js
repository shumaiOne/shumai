/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_VariableInputs */

const en_add_variable = /** @type {(inputs: Add_VariableInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Add Variable`)
}

const zh_add_variable = /** @type {(inputs: Add_VariableInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`添加变量`)
}

/**
 * | output |
 * | --- |
 * | "Add Variable" |
 *
 * @param {Add_VariableInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_variable =
  /** @type {((inputs?: Add_VariableInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_VariableInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_add_variable(inputs)
      return zh_add_variable(inputs)
    }
  )
