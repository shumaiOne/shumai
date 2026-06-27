/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provide_Name_Email_For_CommentInputs */

const en_provide_name_email_for_comment =
  /** @type {(inputs: Provide_Name_Email_For_CommentInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Please provide your name and email to add a comment.`)
  }

const zh_provide_name_email_for_comment =
  /** @type {(inputs: Provide_Name_Email_For_CommentInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`请提供您的姓名和邮箱以添加评论。`)
  }

/**
 * | output |
 * | --- |
 * | "Please provide your name and email to add a comment." |
 *
 * @param {Provide_Name_Email_For_CommentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const provide_name_email_for_comment =
  /** @type {((inputs?: Provide_Name_Email_For_CommentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provide_Name_Email_For_CommentInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_provide_name_email_for_comment(inputs)
      return zh_provide_name_email_for_comment(inputs)
    }
  )
