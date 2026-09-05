/**
* | output |
* | --- |
* | "Configure API Key" |
*
* @param {Configure_Api_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const configure_api_key: ((inputs?: Configure_Api_KeyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Configure_Api_KeyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Configure_Api_KeyInputs = {};
