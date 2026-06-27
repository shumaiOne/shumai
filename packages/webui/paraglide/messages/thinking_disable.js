/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_DisableInputs */

const en_thinking_disable =
  /** @type {(inputs: Thinking_DisableInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Disable`)
  }

const zh_thinking_disable =
  /** @type {(inputs: Thinking_DisableInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`禁用`)
  }

/**
 * | output |
 * | --- |
 * | "Disable" |
 *
 * @param {Thinking_DisableInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_disable =
  /** @type {((inputs?: Thinking_DisableInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_DisableInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_thinking_disable(inputs)
      return zh_thinking_disable(inputs)
    }
  )
