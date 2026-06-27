/**
 * | output |
 * | --- |
 * | "Folder deleted" |
 *
 * @param {Folder_DeletedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const folder_deleted: ((
  inputs?: Folder_DeletedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Folder_DeletedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Folder_DeletedInputs = {}
