/**
* | output |
* | --- |
* | "Sign up" |
*
* @param {Sign_UpInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sign_up: ((inputs?: Sign_UpInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sign_UpInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sign_UpInputs = {};
