/**
 * | output |
 * | --- |
 * | "No description provided." |
 *
 * @param {No_Description_ProvidedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_description_provided: ((
  inputs?: No_Description_ProvidedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Description_ProvidedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Description_ProvidedInputs = {}
