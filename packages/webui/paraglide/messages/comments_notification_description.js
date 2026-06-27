/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Comments_Notification_DescriptionInputs */

const en_comments_notification_description =
  /** @type {(inputs: Comments_Notification_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Control notification preferences when other users comment on assets you collaborate on or mention you.`
    )
  }

const zh_comments_notification_description =
  /** @type {(inputs: Comments_Notification_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`控制其他用户对您协作的素材评论或提及您时的通知偏好。`)
  }

/**
 * | output |
 * | --- |
 * | "Control notification preferences when other users comment on assets you collaborate on or mention you." |
 *
 * @param {Comments_Notification_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const comments_notification_description =
  /** @type {((inputs?: Comments_Notification_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Comments_Notification_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_comments_notification_description(inputs)
      return zh_comments_notification_description(inputs)
    }
  )
