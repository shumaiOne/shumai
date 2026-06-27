/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Comments_And_RepliesInputs */

const en_comments_and_replies =
  /** @type {(inputs: Comments_And_RepliesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Comments & Replies`)
  }

const zh_comments_and_replies =
  /** @type {(inputs: Comments_And_RepliesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`评论与回复`)
  }

/**
 * | output |
 * | --- |
 * | "Comments & Replies" |
 *
 * @param {Comments_And_RepliesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const comments_and_replies =
  /** @type {((inputs?: Comments_And_RepliesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Comments_And_RepliesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_comments_and_replies(inputs)
      return zh_comments_and_replies(inputs)
    }
  )
