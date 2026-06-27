/**
* | output |
* | --- |
* | "Failed to rename collection" |
*
* @param {Failed_Rename_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_rename_collection: ((inputs?: Failed_Rename_CollectionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Rename_CollectionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Rename_CollectionInputs = {};
