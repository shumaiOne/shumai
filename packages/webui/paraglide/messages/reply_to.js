/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Reply_ToInputs */

const en_reply_to = /** @type {(inputs: Reply_ToInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`reply to:`)
}

const zh_reply_to = /** @type {(inputs: Reply_ToInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`回复：`)
}

/**
 * | output |
 * | --- |
 * | "reply to:" |
 *
 * @param {Reply_ToInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const reply_to =
  /** @type {((inputs?: Reply_ToInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Reply_ToInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_reply_to(inputs)
      return zh_reply_to(inputs)
    }
  )
