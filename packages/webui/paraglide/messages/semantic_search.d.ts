/**
* | output |
* | --- |
* | "Semantic Search" |
*
* @param {Semantic_SearchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const semantic_search: ((inputs?: Semantic_SearchInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Semantic_SearchInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Semantic_SearchInputs = {};
