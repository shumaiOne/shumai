/**
* | output |
* | --- |
* | "Edit API Key" |
*
* @param {Edit_Api_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_api_key: ((inputs?: Edit_Api_KeyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Edit_Api_KeyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Edit_Api_KeyInputs = {};
