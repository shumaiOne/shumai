/**
* | output |
* | --- |
* | "Model removed successfully" |
*
* @param {Model_Removed_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_removed_successfully: ((inputs?: Model_Removed_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Removed_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Removed_SuccessfullyInputs = {};
