/**
* | output |
* | --- |
* | "reasoning" |
*
* @param {Sync_Providers_ReasoningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_reasoning: ((inputs?: Sync_Providers_ReasoningInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_ReasoningInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_ReasoningInputs = {};
