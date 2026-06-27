/**
 * | output |
 * | --- |
 * | "Calling Tool:" |
 *
 * @param {Calling_ToolInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const calling_tool: ((
  inputs?: Calling_ToolInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Calling_ToolInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Calling_ToolInputs = {}
