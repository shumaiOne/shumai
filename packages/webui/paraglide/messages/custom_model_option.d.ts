/**
* | output |
* | --- |
* | "Custom Model..." |
*
* @param {Custom_Model_OptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const custom_model_option: ((inputs?: Custom_Model_OptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Custom_Model_OptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Custom_Model_OptionInputs = {};
