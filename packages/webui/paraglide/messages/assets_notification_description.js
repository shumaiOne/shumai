/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Assets_Notification_DescriptionInputs */

const en_assets_notification_description =
  /** @type {(inputs: Assets_Notification_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Manage notifications related to file uploads and metadata field status updates.`
    )
  }

const zh_assets_notification_description =
  /** @type {(inputs: Assets_Notification_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`管理与文件上传和元数据字段状态更新相关的通知。`)
  }

/**
 * | output |
 * | --- |
 * | "Manage notifications related to file uploads and metadata field status updates." |
 *
 * @param {Assets_Notification_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const assets_notification_description =
  /** @type {((inputs?: Assets_Notification_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Assets_Notification_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_assets_notification_description(inputs)
      return zh_assets_notification_description(inputs)
    }
  )
