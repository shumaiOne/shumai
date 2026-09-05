/**
* | output |
* | --- |
* | "Search models..." |
*
* @param {Search_ModelsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_models: ((inputs?: Search_ModelsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Search_ModelsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Search_ModelsInputs = {};
