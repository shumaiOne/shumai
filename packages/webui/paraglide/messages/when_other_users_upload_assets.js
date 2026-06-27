/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} When_Other_Users_Upload_AssetsInputs */

const en_when_other_users_upload_assets =
  /** @type {(inputs: When_Other_Users_Upload_AssetsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`When other users upload assets`)
  }

const zh_when_other_users_upload_assets =
  /** @type {(inputs: When_Other_Users_Upload_AssetsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`当其他用户上传素材时`)
  }

/**
 * | output |
 * | --- |
 * | "When other users upload assets" |
 *
 * @param {When_Other_Users_Upload_AssetsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const when_other_users_upload_assets =
  /** @type {((inputs?: When_Other_Users_Upload_AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<When_Other_Users_Upload_AssetsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_when_other_users_upload_assets(inputs)
      return zh_when_other_users_upload_assets(inputs)
    }
  )
