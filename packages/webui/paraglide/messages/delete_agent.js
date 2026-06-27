/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_AgentInputs */

const en_delete_agent = /** @type {(inputs: Delete_AgentInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Delete Agent`)
}

const zh_delete_agent = /** @type {(inputs: Delete_AgentInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`删除智能体`)
}

/**
 * | output |
 * | --- |
 * | "Delete Agent" |
 *
 * @param {Delete_AgentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_agent =
  /** @type {((inputs?: Delete_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_AgentInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_delete_agent(inputs)
      return zh_delete_agent(inputs)
    }
  )
