/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Moved_To_TrashInputs */

const en_moved_to_trash = /** @type {(inputs: Moved_To_TrashInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Moved to trash`)
}

const zh_moved_to_trash = /** @type {(inputs: Moved_To_TrashInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`已移至回收站`)
}

/**
 * | output |
 * | --- |
 * | "Moved to trash" |
 *
 * @param {Moved_To_TrashInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const moved_to_trash =
  /** @type {((inputs?: Moved_To_TrashInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Moved_To_TrashInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_moved_to_trash(inputs)
      return zh_moved_to_trash(inputs)
    }
  )
