/**
* | output |
* | --- |
* | "No folder selected" |
*
* @param {No_Folder_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_folder_selected: ((inputs?: No_Folder_SelectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Folder_SelectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Folder_SelectedInputs = {};
