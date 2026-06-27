/**
 * | output |
 * | --- |
 * | "Autofilling metadata..." |
 *
 * @param {Autofilling_MetadataInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const autofilling_metadata: ((
  inputs?: Autofilling_MetadataInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Autofilling_MetadataInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Autofilling_MetadataInputs = {}
