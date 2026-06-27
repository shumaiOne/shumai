/**
 * | output |
 * | --- |
 * | "Renamed successfully" |
 *
 * @param {Renamed_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const renamed_successfully: ((
  inputs?: Renamed_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Renamed_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Renamed_SuccessfullyInputs = {}
