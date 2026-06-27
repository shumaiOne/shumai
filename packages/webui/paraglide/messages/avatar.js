/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AvatarInputs */

const en_avatar = /** @type {(inputs: AvatarInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Avatar`)
}

const zh_avatar = /** @type {(inputs: AvatarInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`头像`)
}

/**
 * | output |
 * | --- |
 * | "Avatar" |
 *
 * @param {AvatarInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const avatar =
  /** @type {((inputs?: AvatarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AvatarInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_avatar(inputs)
      return zh_avatar(inputs)
    }
  )
