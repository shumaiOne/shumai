/**
* | output |
* | --- |
* | "Apply and Close" |
*
* @param {Apply_And_CloseInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const apply_and_close: ((inputs?: Apply_And_CloseInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Apply_And_CloseInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Apply_And_CloseInputs = {};
