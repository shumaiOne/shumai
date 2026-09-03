/**
* | output |
* | --- |
* | "{count} new models" |
*
* @param {Sync_Providers_New_Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_new_models_count: ((inputs: Sync_Providers_New_Models_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_New_Models_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_New_Models_CountInputs = {
    count: NonNullable<unknown>;
};
