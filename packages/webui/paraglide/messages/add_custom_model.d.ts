/**
* | output |
* | --- |
* | "Add Custom Model" |
*
* @param {Add_Custom_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_custom_model: ((inputs?: Add_Custom_ModelInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Custom_ModelInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Custom_ModelInputs = {};
