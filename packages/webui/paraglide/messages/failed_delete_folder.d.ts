/**
* | output |
* | --- |
* | "Failed to delete folder" |
*
* @param {Failed_Delete_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_folder: ((inputs?: Failed_Delete_FolderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Delete_FolderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Delete_FolderInputs = {};
