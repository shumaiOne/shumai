/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Avatar_RemovedInputs */

const en_avatar_removed = /** @type {(inputs: Avatar_RemovedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Avatar removed successfully`)
}

const zh_avatar_removed = /** @type {(inputs: Avatar_RemovedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`头像已移除`)
}

/**
 * | output |
 * | --- |
 * | "Avatar removed successfully" |
 *
 * @param {Avatar_RemovedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const avatar_removed =
  /** @type {((inputs?: Avatar_RemovedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Avatar_RemovedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_avatar_removed(inputs)
      return zh_avatar_removed(inputs)
    }
  )
