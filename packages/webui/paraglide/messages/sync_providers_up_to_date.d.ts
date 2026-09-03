/**
* | output |
* | --- |
* | "All providers and models are already up to date." |
*
* @param {Sync_Providers_Up_To_DateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_up_to_date: ((inputs?: Sync_Providers_Up_To_DateInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_Up_To_DateInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_Up_To_DateInputs = {};
