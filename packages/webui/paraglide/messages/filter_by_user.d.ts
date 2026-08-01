/**
* | output |
* | --- |
* | "Filter by User" |
*
* @param {Filter_By_UserInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_by_user: ((inputs?: Filter_By_UserInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Filter_By_UserInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Filter_By_UserInputs = {};
