/**
* | output |
* | --- |
* | "In Progress" |
*
* @param {Status_In_ProgressInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_in_progress: ((inputs?: Status_In_ProgressInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Status_In_ProgressInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Status_In_ProgressInputs = {};
