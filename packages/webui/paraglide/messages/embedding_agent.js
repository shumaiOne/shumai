/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Embedding_AgentInputs */

const en_embedding_agent = /** @type {(inputs: Embedding_AgentInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Embedding Agent`)
}

const zh_embedding_agent = /** @type {(inputs: Embedding_AgentInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`嵌入智能体`)
}

/**
 * | output |
 * | --- |
 * | "Embedding Agent" |
 *
 * @param {Embedding_AgentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const embedding_agent =
  /** @type {((inputs?: Embedding_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Embedding_AgentInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_embedding_agent(inputs)
      return zh_embedding_agent(inputs)
    }
  )
