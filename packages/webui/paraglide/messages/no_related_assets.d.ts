/**
* | output |
* | --- |
* | "No related assets linked" |
*
* @param {No_Related_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_related_assets: ((inputs?: No_Related_AssetsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Related_AssetsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Related_AssetsInputs = {};
