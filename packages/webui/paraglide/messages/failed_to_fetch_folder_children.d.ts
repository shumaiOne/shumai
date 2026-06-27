/**
* | output |
* | --- |
* | "Failed to fetch folder children" |
*
* @param {Failed_To_Fetch_Folder_ChildrenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_fetch_folder_children: ((inputs?: Failed_To_Fetch_Folder_ChildrenInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Fetch_Folder_ChildrenInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Fetch_Folder_ChildrenInputs = {};
