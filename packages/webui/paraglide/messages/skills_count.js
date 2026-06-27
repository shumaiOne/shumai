/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Skills_CountInputs */

const en_skills_count = /** @type {(inputs: Skills_CountInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Skills`)
}

const zh_skills_count = /** @type {(inputs: Skills_CountInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`技能`)
}

/**
 * | output |
 * | --- |
 * | "Skills" |
 *
 * @param {Skills_CountInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const skills_count =
  /** @type {((inputs?: Skills_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Skills_CountInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_skills_count(inputs)
      return zh_skills_count(inputs)
    }
  )
