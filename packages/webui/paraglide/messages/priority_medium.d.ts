/**
* | output |
* | --- |
* | "Medium" |
*
* @param {Priority_MediumInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const priority_medium: ((inputs?: Priority_MediumInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Priority_MediumInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Priority_MediumInputs = {};
