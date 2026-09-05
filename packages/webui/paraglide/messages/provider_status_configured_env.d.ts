/**
* | output |
* | --- |
* | "Configured (Environment)" |
*
* @param {Provider_Status_Configured_EnvInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_status_configured_env: ((inputs?: Provider_Status_Configured_EnvInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provider_Status_Configured_EnvInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provider_Status_Configured_EnvInputs = {};
