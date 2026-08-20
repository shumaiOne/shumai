/**
* | output |
* | --- |
* | "Urgent" |
*
* @param {Priority_UrgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const priority_urgent: ((inputs?: Priority_UrgentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Priority_UrgentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Priority_UrgentInputs = {};
