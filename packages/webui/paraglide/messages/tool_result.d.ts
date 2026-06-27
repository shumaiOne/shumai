/**
 * | output |
 * | --- |
 * | "Tool Result:" |
 *
 * @param {Tool_ResultInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const tool_result: ((
  inputs?: Tool_ResultInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Tool_ResultInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Tool_ResultInputs = {}
