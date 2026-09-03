/**
* | output |
* | --- |
* | "{count}k ctx" |
*
* @param {Sync_Providers_Context_WindowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_context_window: ((inputs: Sync_Providers_Context_WindowInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_Context_WindowInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_Context_WindowInputs = {
    count: NonNullable<unknown>;
};
