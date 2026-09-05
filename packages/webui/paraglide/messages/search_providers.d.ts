/**
* | output |
* | --- |
* | "Search providers..." |
*
* @param {Search_ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_providers: ((inputs?: Search_ProvidersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Search_ProvidersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Search_ProvidersInputs = {};
