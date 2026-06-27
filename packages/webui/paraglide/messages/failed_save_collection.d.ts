/**
* | output |
* | --- |
* | "Failed to save collection" |
*
* @param {Failed_Save_CollectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_save_collection: ((inputs?: Failed_Save_CollectionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Save_CollectionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Save_CollectionInputs = {};
