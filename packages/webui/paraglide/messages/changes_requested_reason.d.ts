/**
* | output |
* | --- |
* | "Reason for changes requested" |
*
* @param {Changes_Requested_ReasonInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const changes_requested_reason: ((inputs?: Changes_Requested_ReasonInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Changes_Requested_ReasonInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Changes_Requested_ReasonInputs = {};
