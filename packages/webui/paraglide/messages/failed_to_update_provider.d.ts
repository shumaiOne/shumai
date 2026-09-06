/**
* | output |
* | --- |
* | "Failed to update provider" |
*
* @param {Failed_To_Update_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_update_provider: ((inputs?: Failed_To_Update_ProviderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Update_ProviderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Update_ProviderInputs = {};
