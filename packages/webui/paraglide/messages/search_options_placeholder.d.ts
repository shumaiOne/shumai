/**
* | output |
* | --- |
* | "Search options..." |
*
* @param {Search_Options_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_options_placeholder: ((inputs?: Search_Options_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Search_Options_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Search_Options_PlaceholderInputs = {};
