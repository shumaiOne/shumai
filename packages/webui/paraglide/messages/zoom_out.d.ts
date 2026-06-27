/**
 * | output |
 * | --- |
 * | "Zoom Out" |
 *
 * @param {Zoom_OutInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const zoom_out: ((
  inputs?: Zoom_OutInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Zoom_OutInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Zoom_OutInputs = {}
