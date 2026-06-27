/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_NameInputs */

const en_project_name = /** @type {(inputs: Project_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Project Name`)
}

const zh_project_name = /** @type {(inputs: Project_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`项目名称`)
}

/**
 * | output |
 * | --- |
 * | "Project Name" |
 *
 * @param {Project_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_name =
  /** @type {((inputs?: Project_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_NameInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_project_name(inputs)
      return zh_project_name(inputs)
    }
  )
