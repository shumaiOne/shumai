/**
* | output |
* | --- |
* | "Custom Model ID" |
*
* @param {Custom_Model_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const custom_model_id: ((inputs?: Custom_Model_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Custom_Model_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Custom_Model_IdInputs = {};
