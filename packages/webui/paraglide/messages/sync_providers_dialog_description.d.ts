/**
* | output |
* | --- |
* | "Select the new providers and models you want to add. Existing providers, custom endpoints, API keys, and model configurations will never be deleted or modified." |
*
* @param {Sync_Providers_Dialog_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_dialog_description: ((inputs?: Sync_Providers_Dialog_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_Dialog_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_Dialog_DescriptionInputs = {};
