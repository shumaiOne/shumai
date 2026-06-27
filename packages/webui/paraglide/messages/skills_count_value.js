/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Skills_Count_ValueInputs */

const en_skills_count_value = /** @type {(inputs: Skills_Count_ValueInputs) => LocalizedString} */ (
  i,
) => {
  return /** @type {LocalizedString} */ (`${i?.count} Skills`)
}

const zh_skills_count_value = /** @type {(inputs: Skills_Count_ValueInputs) => LocalizedString} */ (
  i,
) => {
  return /** @type {LocalizedString} */ (`${i?.count} 个技能`)
}

/**
 * | output |
 * | --- |
 * | "{count} Skills" |
 *
 * @param {Skills_Count_ValueInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const skills_count_value =
  /** @type {((inputs: Skills_Count_ValueInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Skills_Count_ValueInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_skills_count_value(inputs)
      return zh_skills_count_value(inputs)
    }
  )
