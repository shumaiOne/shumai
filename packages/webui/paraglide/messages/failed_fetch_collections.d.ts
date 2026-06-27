/**
* | output |
* | --- |
* | "Failed to fetch collections" |
*
* @param {Failed_Fetch_CollectionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_collections: ((inputs?: Failed_Fetch_CollectionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Fetch_CollectionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Fetch_CollectionsInputs = {};
