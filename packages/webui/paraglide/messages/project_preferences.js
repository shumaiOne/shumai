/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_PreferencesInputs */

const en_project_preferences =
  /** @type {(inputs: Project_PreferencesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Project Preferences`)
  }

const zh_project_preferences =
  /** @type {(inputs: Project_PreferencesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`项目偏好设置`)
  }

/**
 * | output |
 * | --- |
 * | "Project Preferences" |
 *
 * @param {Project_PreferencesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_preferences =
  /** @type {((inputs?: Project_PreferencesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_PreferencesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_project_preferences(inputs)
      return zh_project_preferences(inputs)
    }
  )
