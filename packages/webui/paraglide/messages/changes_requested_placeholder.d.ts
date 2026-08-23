/**
* | output |
* | --- |
* | "Explain what needs to be changed before this task can be accepted..." |
*
* @param {Changes_Requested_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const changes_requested_placeholder: ((inputs?: Changes_Requested_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Changes_Requested_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Changes_Requested_PlaceholderInputs = {};
