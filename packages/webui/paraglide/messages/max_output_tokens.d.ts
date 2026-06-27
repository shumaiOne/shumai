/**
* | output |
* | --- |
* | "Max Output Tokens" |
*
* @param {Max_Output_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const max_output_tokens: ((inputs?: Max_Output_TokensInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Max_Output_TokensInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Max_Output_TokensInputs = {};
