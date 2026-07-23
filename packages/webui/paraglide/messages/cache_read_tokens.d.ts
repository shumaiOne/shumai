/**
* | output |
* | --- |
* | "Cache Read Tokens" |
*
* @param {Cache_Read_TokensInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cache_read_tokens: ((inputs?: Cache_Read_TokensInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Cache_Read_TokensInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Cache_Read_TokensInputs = {};
