/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Skills_ManagementInputs */

const en_skills_management =
  /** @type {(inputs: Skills_ManagementInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Skills Management`)
  }

const zh_skills_management =
  /** @type {(inputs: Skills_ManagementInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`技能管理`)
  }

/**
 * | output |
 * | --- |
 * | "Skills Management" |
 *
 * @param {Skills_ManagementInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const skills_management =
  /** @type {((inputs?: Skills_ManagementInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Skills_ManagementInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_skills_management(inputs)
      return zh_skills_management(inputs)
    }
  )
