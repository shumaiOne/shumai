/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Sandbox_SettingsInputs */

const en_agent_sandbox_settings =
  /** @type {(inputs: Agent_Sandbox_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Agent Sandbox Settings`)
  }

const zh_agent_sandbox_settings =
  /** @type {(inputs: Agent_Sandbox_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`智能体沙箱设置`)
  }

/**
 * | output |
 * | --- |
 * | "Agent Sandbox Settings" |
 *
 * @param {Agent_Sandbox_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_sandbox_settings =
  /** @type {((inputs?: Agent_Sandbox_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Sandbox_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agent_sandbox_settings(inputs)
      return zh_agent_sandbox_settings(inputs)
    }
  )
