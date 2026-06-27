/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Attach_FilesInputs */

const en_attach_files = /** @type {(inputs: Attach_FilesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Attach files`)
}

const zh_attach_files = /** @type {(inputs: Attach_FilesInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`附加文件`)
}

/**
 * | output |
 * | --- |
 * | "Attach files" |
 *
 * @param {Attach_FilesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const attach_files =
  /** @type {((inputs?: Attach_FilesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Attach_FilesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_attach_files(inputs)
      return zh_attach_files(inputs)
    }
  )
