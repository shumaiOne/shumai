/**
 * | output |
 * | --- |
 * | "Model is required" |
 *
 * @param {Model_Is_RequiredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const model_is_required: ((
  inputs?: Model_Is_RequiredInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Model_Is_RequiredInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Model_Is_RequiredInputs = {}
