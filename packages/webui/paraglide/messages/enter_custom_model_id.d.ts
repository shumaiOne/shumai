/**
* | output |
* | --- |
* | "Enter custom model ID" |
*
* @param {Enter_Custom_Model_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_custom_model_id: ((inputs?: Enter_Custom_Model_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enter_Custom_Model_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enter_Custom_Model_IdInputs = {};
