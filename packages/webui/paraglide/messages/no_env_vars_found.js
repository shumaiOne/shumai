/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Env_Vars_FoundInputs */

const en_no_env_vars_found =
  /** @type {(inputs: No_Env_Vars_FoundInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `No environment variables found. Click "Add Variable" to create one.`
    )
  }

const zh_no_env_vars_found =
  /** @type {(inputs: No_Env_Vars_FoundInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`未找到环境变量。点击"添加变量"创建一个。`)
  }

/**
 * | output |
 * | --- |
 * | "No environment variables found. Click \"Add Variable\" to create one." |
 *
 * @param {No_Env_Vars_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_env_vars_found =
  /** @type {((inputs?: No_Env_Vars_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Env_Vars_FoundInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_env_vars_found(inputs)
      return zh_no_env_vars_found(inputs)
    }
  )
