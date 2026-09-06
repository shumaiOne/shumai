/**
* | output |
* | --- |
* | "Model added successfully" |
*
* @param {Model_Added_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_added_successfully: ((inputs?: Model_Added_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Added_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Added_SuccessfullyInputs = {};
