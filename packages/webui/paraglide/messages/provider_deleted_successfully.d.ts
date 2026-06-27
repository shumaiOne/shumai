/**
* | output |
* | --- |
* | "Provider deleted successfully" |
*
* @param {Provider_Deleted_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_deleted_successfully: ((inputs?: Provider_Deleted_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provider_Deleted_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provider_Deleted_SuccessfullyInputs = {};
