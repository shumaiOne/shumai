/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Avatar_SourceInputs */

const en_avatar_source = /** @type {(inputs: Avatar_SourceInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Avatar Source`)
}

const zh_avatar_source = /** @type {(inputs: Avatar_SourceInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`头像来源`)
}

/**
 * | output |
 * | --- |
 * | "Avatar Source" |
 *
 * @param {Avatar_SourceInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const avatar_source =
  /** @type {((inputs?: Avatar_SourceInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Avatar_SourceInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_avatar_source(inputs)
      return zh_avatar_source(inputs)
    }
  )
