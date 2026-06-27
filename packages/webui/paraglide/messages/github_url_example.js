/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Github_Url_ExampleInputs */

const en_github_url_example =
  /** @type {(inputs: Github_Url_ExampleInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Example: https://github.com/google/gemini-cli`)
  }

const zh_github_url_example =
  /** @type {(inputs: Github_Url_ExampleInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`示例：https://github.com/google/gemini-cli`)
  }

/**
 * | output |
 * | --- |
 * | "Example: https://github.com/google/gemini-cli" |
 *
 * @param {Github_Url_ExampleInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const github_url_example =
  /** @type {((inputs?: Github_Url_ExampleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Github_Url_ExampleInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_github_url_example(inputs)
      return zh_github_url_example(inputs)
    }
  )
