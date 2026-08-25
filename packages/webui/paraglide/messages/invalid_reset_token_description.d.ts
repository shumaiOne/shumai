/**
* | output |
* | --- |
* | "Please contact your administrator to generate a new password reset link." |
*
* @param {Invalid_Reset_Token_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_reset_token_description: ((inputs?: Invalid_Reset_Token_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Invalid_Reset_Token_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Invalid_Reset_Token_DescriptionInputs = {};
