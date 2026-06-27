/**
* | output |
* | --- |
* | "All resolutions" |
*
* @param {All_ResolutionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_resolutions: ((inputs?: All_ResolutionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<All_ResolutionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type All_ResolutionsInputs = {};
