/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} When_Someone_RepliesInputs */

const en_when_someone_replies =
  /** @type {(inputs: When_Someone_RepliesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`When someone replies to your comment`)
  }

const zh_when_someone_replies =
  /** @type {(inputs: When_Someone_RepliesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`当有人回复你的评论时`)
  }

/**
 * | output |
 * | --- |
 * | "When someone replies to your comment" |
 *
 * @param {When_Someone_RepliesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const when_someone_replies =
  /** @type {((inputs?: When_Someone_RepliesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<When_Someone_RepliesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_when_someone_replies(inputs)
      return zh_when_someone_replies(inputs)
    }
  )
