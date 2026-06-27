/**
 * | output |
 * | --- |
 * | "Trash emptied successfully" |
 *
 * @param {Trash_Emptied_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const trash_emptied_successfully: ((
  inputs?: Trash_Emptied_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Trash_Emptied_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Trash_Emptied_SuccessfullyInputs = {}
