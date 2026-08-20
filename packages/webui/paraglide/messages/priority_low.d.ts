/**
* | output |
* | --- |
* | "Low" |
*
* @param {Priority_LowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const priority_low: ((inputs?: Priority_LowInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Priority_LowInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Priority_LowInputs = {};
