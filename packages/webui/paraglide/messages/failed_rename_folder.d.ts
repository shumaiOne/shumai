/**
* | output |
* | --- |
* | "Failed to rename folder" |
*
* @param {Failed_Rename_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_rename_folder: ((inputs?: Failed_Rename_FolderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Rename_FolderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Rename_FolderInputs = {};
