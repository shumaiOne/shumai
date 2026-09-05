/**
* | output |
* | --- |
* | "Are you sure you want to remove this model?" |
*
* @param {Remove_Model_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_model_confirm: ((inputs?: Remove_Model_ConfirmInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Remove_Model_ConfirmInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Remove_Model_ConfirmInputs = {};
