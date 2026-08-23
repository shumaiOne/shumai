/**
* | output |
* | --- |
* | "Related Assets" |
*
* @param {Related_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const related_assets: ((inputs?: Related_AssetsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Related_AssetsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Related_AssetsInputs = {};
