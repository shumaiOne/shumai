/**
* | output |
* | --- |
* | "No assets in this folder" |
*
* @param {No_Assets_In_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_assets_in_folder: ((inputs?: No_Assets_In_FolderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Assets_In_FolderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Assets_In_FolderInputs = {};
