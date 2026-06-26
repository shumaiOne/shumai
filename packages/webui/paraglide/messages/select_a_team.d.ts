/**
 * | output |
 * | --- |
 * | "Select a Team" |
 *
 * @param {Select_A_TeamInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_a_team: ((
  inputs?: Select_A_TeamInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Select_A_TeamInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Select_A_TeamInputs = {}
