/**
* | output |
* | --- |
* | "Successfully added {modelCount} models across {providerCount} providers." |
*
* @param {Sync_Providers_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_success: ((inputs: Sync_Providers_SuccessInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_SuccessInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_SuccessInputs = {
    modelCount: NonNullable<unknown>;
    providerCount: NonNullable<unknown>;
};
