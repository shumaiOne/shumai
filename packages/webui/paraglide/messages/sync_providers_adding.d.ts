/**
* | output |
* | --- |
* | "Adding..." |
*
* @param {Sync_Providers_AddingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_adding: ((inputs?: Sync_Providers_AddingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_AddingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_AddingInputs = {};
