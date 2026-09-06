/**
* | output |
* | --- |
* | "Failed to add model" |
*
* @param {Failed_To_Add_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_add_model: ((inputs?: Failed_To_Add_ModelInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Add_ModelInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Add_ModelInputs = {};
