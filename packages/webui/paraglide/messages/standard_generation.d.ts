/**
 * | output |
 * | --- |
 * | "Standard generation" |
 *
 * @param {Standard_GenerationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const standard_generation: ((
  inputs?: Standard_GenerationInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Standard_GenerationInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Standard_GenerationInputs = {}
