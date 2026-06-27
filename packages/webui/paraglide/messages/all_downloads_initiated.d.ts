/**
* | output |
* | --- |
* | "All downloads initiated successfully" |
*
* @param {All_Downloads_InitiatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_downloads_initiated: ((inputs?: All_Downloads_InitiatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<All_Downloads_InitiatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type All_Downloads_InitiatedInputs = {};
