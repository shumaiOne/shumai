/**
* | output |
* | --- |
* | "Failed to load sessions" |
*
* @param {Failed_To_LoadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_load: ((inputs?: Failed_To_LoadInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_LoadInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_LoadInputs = {};
