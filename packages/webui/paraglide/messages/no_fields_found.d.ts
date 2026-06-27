/**
 * | output |
 * | --- |
 * | "No fields found" |
 *
 * @param {No_Fields_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_fields_found: ((
  inputs?: No_Fields_FoundInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Fields_FoundInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Fields_FoundInputs = {}
