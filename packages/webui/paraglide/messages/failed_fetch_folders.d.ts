/**
* | output |
* | --- |
* | "Failed to fetch folders" |
*
* @param {Failed_Fetch_FoldersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_folders: ((inputs?: Failed_Fetch_FoldersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Fetch_FoldersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Fetch_FoldersInputs = {};
