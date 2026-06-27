/**
 * | output |
 * | --- |
 * | "Please create and enable an embedding agent in the team settings to use semantic search." |
 *
 * @param {Enable_Embedding_Agent_HintInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enable_embedding_agent_hint: ((
  inputs?: Enable_Embedding_Agent_HintInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Enable_Embedding_Agent_HintInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Enable_Embedding_Agent_HintInputs = {}
