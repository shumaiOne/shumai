/**
* | output |
* | --- |
* | "Output Tokens" |
*
* @param {Output_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const output_tokens: ((inputs?: Output_TokensInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Output_TokensInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Output_TokensInputs = {};
