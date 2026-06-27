/**
 * | output |
 * | --- |
 * | "{count} Skills" |
 *
 * @param {Skills_Count_ValueInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const skills_count_value: ((
  inputs: Skills_Count_ValueInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Skills_Count_ValueInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Skills_Count_ValueInputs = {
  count: NonNullable<unknown>
}
