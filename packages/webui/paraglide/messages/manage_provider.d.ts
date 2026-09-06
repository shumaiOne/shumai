/**
* | output |
* | --- |
* | "Manage" |
*
* @param {Manage_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_provider: ((inputs?: Manage_ProviderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Manage_ProviderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Manage_ProviderInputs = {};
