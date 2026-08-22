/**
* | output |
* | --- |
* | "Asset linked to task" |
*
* @param {Asset_LinkedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const asset_linked: ((inputs?: Asset_LinkedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Asset_LinkedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Asset_LinkedInputs = {};
