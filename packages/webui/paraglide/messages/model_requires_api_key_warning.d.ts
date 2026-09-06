/**
* | output |
* | --- |
* | "This provider is not configured. Tools using this model will not be available until an API key is configured." |
*
* @param {Model_Requires_Api_Key_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_requires_api_key_warning: ((inputs?: Model_Requires_Api_Key_WarningInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Requires_Api_Key_WarningInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Requires_Api_Key_WarningInputs = {};
