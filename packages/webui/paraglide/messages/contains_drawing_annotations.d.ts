/**
 * | output |
 * | --- |
 * | "Contains drawing annotations" |
 *
 * @param {Contains_Drawing_AnnotationsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const contains_drawing_annotations: ((
  inputs?: Contains_Drawing_AnnotationsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Contains_Drawing_AnnotationsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Contains_Drawing_AnnotationsInputs = {}
