/**
* | output |
* | --- |
* | "Not Configured" |
*
* @param {Provider_Status_Not_ConfiguredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_status_not_configured: ((inputs?: Provider_Status_Not_ConfiguredInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provider_Status_Not_ConfiguredInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provider_Status_Not_ConfiguredInputs = {};
