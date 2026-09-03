/**
* | output |
* | --- |
* | "Collapse All" |
*
* @param {Sync_Providers_Collapse_AllInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_collapse_all: ((inputs?: Sync_Providers_Collapse_AllInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_Collapse_AllInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_Collapse_AllInputs = {};
