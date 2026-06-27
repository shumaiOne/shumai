/**
* | output |
* | --- |
* | "At least one model is required" |
*
* @param {At_Least_One_Model_RequiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const at_least_one_model_required: ((inputs?: At_Least_One_Model_RequiredInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<At_Least_One_Model_RequiredInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type At_Least_One_Model_RequiredInputs = {};
