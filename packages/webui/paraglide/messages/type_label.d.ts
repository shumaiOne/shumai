/**
 * | output |
 * | --- |
 * | "Type:" |
 *
 * @param {Type_LabelInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const type_label: ((
  inputs?: Type_LabelInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Type_LabelInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Type_LabelInputs = {}
