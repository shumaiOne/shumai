/**
* | output |
* | --- |
* | "Input Tokens" |
*
* @param {Input_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const input_tokens: ((inputs?: Input_TokensInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Input_TokensInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Input_TokensInputs = {};
