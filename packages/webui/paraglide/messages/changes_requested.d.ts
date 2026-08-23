/**
* | output |
* | --- |
* | "Changes requested" |
*
* @param {Changes_RequestedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const changes_requested: ((inputs?: Changes_RequestedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Changes_RequestedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Changes_RequestedInputs = {};
