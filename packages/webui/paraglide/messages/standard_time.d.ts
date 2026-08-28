/**
* | output |
* | --- |
* | "Standard Time" |
*
* @param {Standard_TimeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const standard_time: ((inputs?: Standard_TimeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Standard_TimeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Standard_TimeInputs = {};
