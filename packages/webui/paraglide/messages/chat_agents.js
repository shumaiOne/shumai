/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chat_AgentsInputs */

const en_chat_agents = /** @type {(inputs: Chat_AgentsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Chat Agents`)
}

const zh_chat_agents = /** @type {(inputs: Chat_AgentsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`对话智能体`)
}

/**
 * | output |
 * | --- |
 * | "Chat Agents" |
 *
 * @param {Chat_AgentsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const chat_agents =
  /** @type {((inputs?: Chat_AgentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chat_AgentsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_chat_agents(inputs)
      return zh_chat_agents(inputs)
    }
  )
