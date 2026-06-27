/**
* | output |
* | --- |
* | "Search providers..." |
*
* @param {Search_Providers_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_providers_placeholder: ((inputs?: Search_Providers_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Search_Providers_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Search_Providers_PlaceholderInputs = {};
