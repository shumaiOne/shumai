/**
* | output |
* | --- |
* | "Go to Login" |
*
* @param {Go_To_LoginInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const go_to_login: ((inputs?: Go_To_LoginInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Go_To_LoginInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Go_To_LoginInputs = {};
