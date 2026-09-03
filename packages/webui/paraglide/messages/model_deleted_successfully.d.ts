/**
* | output |
* | --- |
* | "Model deleted successfully" |
*
* @param {Model_Deleted_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_deleted_successfully: ((inputs?: Model_Deleted_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Deleted_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Deleted_SuccessfullyInputs = {};
