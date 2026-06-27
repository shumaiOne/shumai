/**
 * | output |
 * | --- |
 * | "({count} visible)" |
 *
 * @param {Visible_CountInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const visible_count: ((
  inputs: Visible_CountInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Visible_CountInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Visible_CountInputs = {
  count: NonNullable<unknown>
}
