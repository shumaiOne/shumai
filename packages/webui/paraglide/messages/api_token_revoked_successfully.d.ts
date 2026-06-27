/**
* | output |
* | --- |
* | "API token revoked successfully" |
*
* @param {Api_Token_Revoked_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_token_revoked_successfully: ((inputs?: Api_Token_Revoked_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Api_Token_Revoked_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Api_Token_Revoked_SuccessfullyInputs = {};
