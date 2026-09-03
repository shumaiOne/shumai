/**
* | output |
* | --- |
* | "Checking for updates..." |
*
* @param {Sync_Providers_CheckingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_checking: ((inputs?: Sync_Providers_CheckingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_CheckingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_CheckingInputs = {};
