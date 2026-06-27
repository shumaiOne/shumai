/**
* | output |
* | --- |
* | "Provider name is required" |
*
* @param {Provider_Name_Is_RequiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_name_is_required: ((inputs?: Provider_Name_Is_RequiredInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provider_Name_Is_RequiredInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provider_Name_Is_RequiredInputs = {};
