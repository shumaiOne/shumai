/**
* | output |
* | --- |
* | "Total Tokens" |
*
* @param {Total_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const total_tokens: ((inputs?: Total_TokensInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Total_TokensInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Total_TokensInputs = {};
