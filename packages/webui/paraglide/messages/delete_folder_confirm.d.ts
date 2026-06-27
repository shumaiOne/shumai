/**
 * | output |
 * | --- |
 * | "Delete Folder?" |
 *
 * @param {Delete_Folder_ConfirmInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_folder_confirm: ((
  inputs?: Delete_Folder_ConfirmInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_Folder_ConfirmInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_Folder_ConfirmInputs = {}
