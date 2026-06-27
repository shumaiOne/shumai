/**
* | output |
* | --- |
* | "Failed to delete collection" |
*
* @param {Failed_Delete_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_collection: ((inputs?: Failed_Delete_CollectionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Delete_CollectionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Delete_CollectionInputs = {};
