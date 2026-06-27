/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Role_ThinkingInputs */

const en_role_thinking = /** @type {(inputs: Role_ThinkingInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Thinking`)
}

const zh_role_thinking = /** @type {(inputs: Role_ThinkingInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`思考中`)
}

/**
 * | output |
 * | --- |
 * | "Thinking" |
 *
 * @param {Role_ThinkingInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const role_thinking =
  /** @type {((inputs?: Role_ThinkingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Role_ThinkingInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_role_thinking(inputs)
      return zh_role_thinking(inputs)
    }
  )
