/**
* | output |
* | --- |
* | "Configured (Custom)" |
*
* @param {Provider_Status_Configured_CustomInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_status_configured_custom: ((inputs?: Provider_Status_Configured_CustomInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provider_Status_Configured_CustomInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provider_Status_Configured_CustomInputs = {};
