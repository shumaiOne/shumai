/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_CoverInputs */

const en_project_cover = /** @type {(inputs: Project_CoverInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Project Cover`)
}

const zh_project_cover = /** @type {(inputs: Project_CoverInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`项目封面`)
}

/**
 * | output |
 * | --- |
 * | "Project Cover" |
 *
 * @param {Project_CoverInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_cover =
  /** @type {((inputs?: Project_CoverInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_CoverInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_project_cover(inputs)
      return zh_project_cover(inputs)
    }
  )
