/**
 * | output |
 * | --- |
 * | "Embedding Agent" |
 *
 * @param {Embedding_AgentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const embedding_agent: ((
  inputs?: Embedding_AgentInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Embedding_AgentInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Embedding_AgentInputs = {}
