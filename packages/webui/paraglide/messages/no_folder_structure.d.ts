/**
 * | output |
 * | --- |
 * | "No Folder Structure" |
 *
 * @param {No_Folder_StructureInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_folder_structure: ((
  inputs?: No_Folder_StructureInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Folder_StructureInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Folder_StructureInputs = {}
