/**
* | output |
* | --- |
* | "Exit compare" |
*
* @param {Exit_CompareInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const exit_compare: ((inputs?: Exit_CompareInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Exit_CompareInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Exit_CompareInputs = {};
