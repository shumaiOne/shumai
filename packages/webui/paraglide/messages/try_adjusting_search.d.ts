/**
* | output |
* | --- |
* | "Try adjusting your search for \"{query}\"" |
*
* @param {Try_Adjusting_SearchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const try_adjusting_search: ((inputs: Try_Adjusting_SearchInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Try_Adjusting_SearchInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Try_Adjusting_SearchInputs = {
    query: NonNullable<unknown>;
};
