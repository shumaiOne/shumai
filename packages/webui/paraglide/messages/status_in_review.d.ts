/**
* | output |
* | --- |
* | "In Review" |
*
* @param {Status_In_ReviewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_in_review: ((inputs?: Status_In_ReviewInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Status_In_ReviewInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Status_In_ReviewInputs = {};
