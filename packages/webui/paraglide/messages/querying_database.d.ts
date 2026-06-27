/**
 * | output |
 * | --- |
 * | "Querying database..." |
 *
 * @param {Querying_DatabaseInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const querying_database: ((
  inputs?: Querying_DatabaseInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Querying_DatabaseInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Querying_DatabaseInputs = {}
