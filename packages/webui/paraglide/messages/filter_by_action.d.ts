/**
* | output |
* | --- |
* | "Filter by Action" |
*
* @param {Filter_By_ActionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_by_action: ((inputs?: Filter_By_ActionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Filter_By_ActionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Filter_By_ActionInputs = {};
