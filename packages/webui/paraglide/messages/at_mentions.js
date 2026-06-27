/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} At_MentionsInputs */

const en_at_mentions = /** @type {(inputs: At_MentionsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`@Mentions`)
}

const zh_at_mentions = /** @type {(inputs: At_MentionsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`@提及`)
}

/**
 * | output |
 * | --- |
 * | "@Mentions" |
 *
 * @param {At_MentionsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const at_mentions =
  /** @type {((inputs?: At_MentionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<At_MentionsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_at_mentions(inputs)
      return zh_at_mentions(inputs)
    }
  )
