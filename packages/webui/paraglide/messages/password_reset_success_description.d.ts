/**
* | output |
* | --- |
* | "You will be redirected to the login page shortly." |
*
* @param {Password_Reset_Success_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_reset_success_description: ((inputs?: Password_Reset_Success_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Password_Reset_Success_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Password_Reset_Success_DescriptionInputs = {};
