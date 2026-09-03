/**
* | output |
* | --- |
* | "Sync Providers" |
*
* @param {Sync_ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers: ((inputs?: Sync_ProvidersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_ProvidersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_ProvidersInputs = {};
