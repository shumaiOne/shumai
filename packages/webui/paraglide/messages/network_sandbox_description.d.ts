/**
* | output |
* | --- |
* | "Configure allowed domains for the sandboxed agent. By default, only essential domains are allowed." |
*
* @param {Network_Sandbox_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_sandbox_description: ((inputs?: Network_Sandbox_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Network_Sandbox_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Network_Sandbox_DescriptionInputs = {};
