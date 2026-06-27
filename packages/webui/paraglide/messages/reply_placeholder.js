/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Reply_PlaceholderInputs */

const en_reply_placeholder =
  /** @type {(inputs: Reply_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Reply...`)
  }

const zh_reply_placeholder =
  /** @type {(inputs: Reply_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`回复...`)
  }

/**
 * | output |
 * | --- |
 * | "Reply..." |
 *
 * @param {Reply_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const reply_placeholder =
  /** @type {((inputs?: Reply_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Reply_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_reply_placeholder(inputs)
      return zh_reply_placeholder(inputs)
    }
  )
