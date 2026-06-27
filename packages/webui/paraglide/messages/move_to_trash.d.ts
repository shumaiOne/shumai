/**
 * | output |
 * | --- |
 * | "Move to Trash" |
 *
 * @param {Move_To_TrashInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const move_to_trash: ((
  inputs?: Move_To_TrashInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Move_To_TrashInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Move_To_TrashInputs = {}
