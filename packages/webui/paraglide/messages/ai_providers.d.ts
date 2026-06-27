/**
* | output |
* | --- |
* | "AI Providers" |
*
* @param {Ai_ProvidersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_providers: ((inputs?: Ai_ProvidersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Ai_ProvidersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Ai_ProvidersInputs = {};
