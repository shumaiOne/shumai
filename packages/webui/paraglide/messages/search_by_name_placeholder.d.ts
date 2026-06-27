/**
* | output |
* | --- |
* | "Search records by name..." |
*
* @param {Search_By_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_by_name_placeholder: ((inputs?: Search_By_Name_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Search_By_Name_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Search_By_Name_PlaceholderInputs = {};
