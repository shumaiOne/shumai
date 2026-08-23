/**
* | output |
* | --- |
* | "Clear" |
*
* @param {Clear_FilterInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const clear_filter: ((inputs?: Clear_FilterInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Clear_FilterInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Clear_FilterInputs = {};
