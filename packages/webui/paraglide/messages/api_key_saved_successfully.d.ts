/**
* | output |
* | --- |
* | "API key updated successfully" |
*
* @param {Api_Key_Saved_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_saved_successfully: ((inputs?: Api_Key_Saved_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Api_Key_Saved_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Api_Key_Saved_SuccessfullyInputs = {};
