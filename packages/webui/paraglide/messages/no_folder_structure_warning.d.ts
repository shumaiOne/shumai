/**
 * | output |
 * | --- |
 * | "Folder hierarchy will be flattened. All nested files will be downloaded directly into your default download folder." |
 *
 * @param {No_Folder_Structure_WarningInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_folder_structure_warning: ((
  inputs?: No_Folder_Structure_WarningInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Folder_Structure_WarningInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Folder_Structure_WarningInputs = {}
