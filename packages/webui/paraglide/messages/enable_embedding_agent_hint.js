/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enable_Embedding_Agent_HintInputs */

const en_enable_embedding_agent_hint =
  /** @type {(inputs: Enable_Embedding_Agent_HintInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Please create and enable an embedding agent in the team settings to use semantic search.`
    )
  }

const zh_enable_embedding_agent_hint =
  /** @type {(inputs: Enable_Embedding_Agent_HintInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`请在团队设置中创建并启用嵌入智能体以使用语义搜索。`)
  }

/**
 * | output |
 * | --- |
 * | "Please create and enable an embedding agent in the team settings to use semantic search." |
 *
 * @param {Enable_Embedding_Agent_HintInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enable_embedding_agent_hint =
  /** @type {((inputs?: Enable_Embedding_Agent_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enable_Embedding_Agent_HintInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_enable_embedding_agent_hint(inputs)
      return zh_enable_embedding_agent_hint(inputs)
    }
  )
