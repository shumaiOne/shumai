/**
 * | output |
 * | --- |
 * | "No {type} agents found" |
 *
 * @param {No_Agents_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_agents_found: ((
  inputs: No_Agents_FoundInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Agents_FoundInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Agents_FoundInputs = {
  type: NonNullable<unknown>
}
