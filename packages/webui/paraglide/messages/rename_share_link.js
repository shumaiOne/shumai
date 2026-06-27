/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Rename_Share_LinkInputs */

const en_rename_share_link =
  /** @type {(inputs: Rename_Share_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Rename Share Link`)
  }

const zh_rename_share_link =
  /** @type {(inputs: Rename_Share_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`重命名分享链接`)
  }

/**
 * | output |
 * | --- |
 * | "Rename Share Link" |
 *
 * @param {Rename_Share_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const rename_share_link =
  /** @type {((inputs?: Rename_Share_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Rename_Share_LinkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_rename_share_link(inputs)
      return zh_rename_share_link(inputs)
    }
  )
