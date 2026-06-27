/**
* | output |
* | --- |
* | "Deep reasoning" |
*
* @param {Deep_ReasoningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const deep_reasoning: ((inputs?: Deep_ReasoningInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Deep_ReasoningInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Deep_ReasoningInputs = {};
