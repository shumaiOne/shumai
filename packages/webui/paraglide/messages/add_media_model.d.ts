/**
* | output |
* | --- |
* | "Add Model" |
*
* @param {Add_Media_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_media_model: ((inputs?: Add_Media_ModelInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Media_ModelInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Media_ModelInputs = {};
