/**
* | output |
* | --- |
* | "New Provider" |
*
* @param {Sync_Providers_New_ProviderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_new_provider: ((inputs?: Sync_Providers_New_ProviderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_New_ProviderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_New_ProviderInputs = {};
