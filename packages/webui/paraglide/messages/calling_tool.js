/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Calling_ToolInputs */

const en_calling_tool = /** @type {(inputs: Calling_ToolInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Calling Tool:`)
}

const zh_calling_tool = /** @type {(inputs: Calling_ToolInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`调用工具：`)
}

/**
 * | output |
 * | --- |
 * | "Calling Tool:" |
 *
 * @param {Calling_ToolInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const calling_tool =
  /** @type {((inputs?: Calling_ToolInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Calling_ToolInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_calling_tool(inputs)
      return zh_calling_tool(inputs)
    }
  )
