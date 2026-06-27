/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Configure_New_Project_DescriptionInputs */

const en_configure_new_project_description =
  /** @type {(inputs: Configure_New_Project_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Configure your new project workspace and appearance.`)
  }

const zh_configure_new_project_description =
  /** @type {(inputs: Configure_New_Project_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`配置您的新项目工作区和外观。`)
  }

/**
 * | output |
 * | --- |
 * | "Configure your new project workspace and appearance." |
 *
 * @param {Configure_New_Project_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const configure_new_project_description =
  /** @type {((inputs?: Configure_New_Project_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Configure_New_Project_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_configure_new_project_description(inputs)
      return zh_configure_new_project_description(inputs)
    }
  )
