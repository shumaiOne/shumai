/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Context_Window_TokensInputs */

const en_context_window_tokens =
  /** @type {(inputs: Context_Window_TokensInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Context Window (tokens)`)
  }

const zh_context_window_tokens =
  /** @type {(inputs: Context_Window_TokensInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`上下文窗口（令牌数）`)
  }

/**
 * | output |
 * | --- |
 * | "Context Window (tokens)" |
 *
 * @param {Context_Window_TokensInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const context_window_tokens =
  /** @type {((inputs?: Context_Window_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Context_Window_TokensInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_context_window_tokens(inputs)
      return zh_context_window_tokens(inputs)
    }
  )
