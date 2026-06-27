/**
* | output |
* | --- |
* | "Add New Provider" |
*
* @param {Add_New_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_new_provider: ((inputs?: Add_New_ProviderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_New_ProviderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_New_ProviderInputs = {};
