/**
* | output |
* | --- |
* | "This provider is not configured. Configure an API key in the API Key tab before using these models." |
*
* @param {Provider_Not_Configured_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_not_configured_warning: ((inputs?: Provider_Not_Configured_WarningInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provider_Not_Configured_WarningInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provider_Not_Configured_WarningInputs = {};
