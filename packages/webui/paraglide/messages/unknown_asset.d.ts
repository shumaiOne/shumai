/**
* | output |
* | --- |
* | "unknown asset" |
*
* @param {Unknown_AssetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unknown_asset: ((inputs?: Unknown_AssetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Unknown_AssetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Unknown_AssetInputs = {};
