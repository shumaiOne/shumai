/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Comment_RepliesInputs */

const en_comment_replies = /** @type {(inputs: Comment_RepliesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Comment Replies`)
}

const zh_comment_replies = /** @type {(inputs: Comment_RepliesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`评论回复`)
}

/**
 * | output |
 * | --- |
 * | "Comment Replies" |
 *
 * @param {Comment_RepliesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const comment_replies =
  /** @type {((inputs?: Comment_RepliesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Comment_RepliesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_comment_replies(inputs)
      return zh_comment_replies(inputs)
    }
  )
