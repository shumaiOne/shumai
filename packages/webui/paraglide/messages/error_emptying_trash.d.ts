/**
 * | output |
 * | --- |
 * | "Error emptying trash" |
 *
 * @param {Error_Emptying_TrashInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const error_emptying_trash: ((
  inputs?: Error_Emptying_TrashInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Error_Emptying_TrashInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Error_Emptying_TrashInputs = {}
