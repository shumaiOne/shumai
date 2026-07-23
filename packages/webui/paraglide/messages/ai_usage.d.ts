/**
* | output |
* | --- |
* | "AI Token Usage" |
*
* @param {Ai_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_usage: ((inputs?: Ai_UsageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Ai_UsageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Ai_UsageInputs = {};
