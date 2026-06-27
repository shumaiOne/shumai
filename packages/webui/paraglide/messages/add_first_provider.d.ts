/**
 * | output |
 * | --- |
 * | "Add your first AI provider to get started." |
 *
 * @param {Add_First_ProviderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_first_provider: ((
  inputs?: Add_First_ProviderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Add_First_ProviderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Add_First_ProviderInputs = {}
