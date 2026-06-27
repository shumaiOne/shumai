/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Create_ProjectInputs */

const en_failed_create_project =
  /** @type {(inputs: Failed_Create_ProjectInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Failed to create project`)
  }

const zh_failed_create_project =
  /** @type {(inputs: Failed_Create_ProjectInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`创建项目失败`)
  }

/**
 * | output |
 * | --- |
 * | "Failed to create project" |
 *
 * @param {Failed_Create_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_create_project =
  /** @type {((inputs?: Failed_Create_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Create_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_create_project(inputs)
      return zh_failed_create_project(inputs)
    }
  )
