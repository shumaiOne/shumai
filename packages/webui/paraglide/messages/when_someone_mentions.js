/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} When_Someone_MentionsInputs */

const en_when_someone_mentions =
  /** @type {(inputs: When_Someone_MentionsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`When someone @mentions you in a comment`)
  }

const zh_when_someone_mentions =
  /** @type {(inputs: When_Someone_MentionsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`当有人在评论中 @提及你时`)
  }

/**
 * | output |
 * | --- |
 * | "When someone @mentions you in a comment" |
 *
 * @param {When_Someone_MentionsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const when_someone_mentions =
  /** @type {((inputs?: When_Someone_MentionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<When_Someone_MentionsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_when_someone_mentions(inputs)
      return zh_when_someone_mentions(inputs)
    }
  )
