/**
* | output |
* | --- |
* | "Asset unlinked from task" |
*
* @param {Asset_UnlinkedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const asset_unlinked: ((inputs?: Asset_UnlinkedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Asset_UnlinkedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Asset_UnlinkedInputs = {};
