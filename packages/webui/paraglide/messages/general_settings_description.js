/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} General_Settings_DescriptionInputs */

const en_general_settings_description =
  /** @type {(inputs: General_Settings_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`View your personal information and team role.`)
  }

const zh_general_settings_description =
  /** @type {(inputs: General_Settings_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`查看您的个人信息和团队角色。`)
  }

/**
 * | output |
 * | --- |
 * | "View your personal information and team role." |
 *
 * @param {General_Settings_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const general_settings_description =
  /** @type {((inputs?: General_Settings_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<General_Settings_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_general_settings_description(inputs)
      return zh_general_settings_description(inputs)
    }
  )
