/**
* | output |
* | --- |
* | "When enabled, network requests from the agent are restricted to allowed domains. When disabled, all network requests are permitted." |
*
* @param {Network_Sandbox_Enabled_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_sandbox_enabled_description: ((inputs?: Network_Sandbox_Enabled_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Network_Sandbox_Enabled_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Network_Sandbox_Enabled_DescriptionInputs = {};
