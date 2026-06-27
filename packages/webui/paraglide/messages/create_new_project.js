/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_New_ProjectInputs */

const en_create_new_project =
  /** @type {(inputs: Create_New_ProjectInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Create New Project`)
  }

const zh_create_new_project =
  /** @type {(inputs: Create_New_ProjectInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`创建新项目`)
  }

/**
 * | output |
 * | --- |
 * | "Create New Project" |
 *
 * @param {Create_New_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const create_new_project =
  /** @type {((inputs?: Create_New_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_New_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_create_new_project(inputs)
      return zh_create_new_project(inputs)
    }
  )
