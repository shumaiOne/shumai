/**
* | output |
* | --- |
* | "Failed to update API key" |
*
* @param {Failed_To_Save_Api_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_save_api_key: ((inputs?: Failed_To_Save_Api_KeyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Save_Api_KeyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Save_Api_KeyInputs = {};
