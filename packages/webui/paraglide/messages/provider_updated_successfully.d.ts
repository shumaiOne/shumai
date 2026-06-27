/**
* | output |
* | --- |
* | "Provider updated successfully" |
*
* @param {Provider_Updated_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_updated_successfully: ((inputs?: Provider_Updated_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provider_Updated_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provider_Updated_SuccessfullyInputs = {};
