/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Github_Repository_UrlInputs */

const en_github_repository_url =
  /** @type {(inputs: Github_Repository_UrlInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`GitHub Repository URL`)
  }

const zh_github_repository_url =
  /** @type {(inputs: Github_Repository_UrlInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`GitHub 仓库 URL`)
  }

/**
 * | output |
 * | --- |
 * | "GitHub Repository URL" |
 *
 * @param {Github_Repository_UrlInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const github_repository_url =
  /** @type {((inputs?: Github_Repository_UrlInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Github_Repository_UrlInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_github_repository_url(inputs)
      return zh_github_repository_url(inputs)
    }
  )
