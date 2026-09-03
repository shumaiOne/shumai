/**
* | output |
* | --- |
* | "Model ID already exists for this provider" |
*
* @param {Model_Id_Already_ExistsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_id_already_exists: ((inputs?: Model_Id_Already_ExistsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Model_Id_Already_ExistsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Model_Id_Already_ExistsInputs = {};
