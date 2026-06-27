/**
* | output |
* | --- |
* | "Generate and manage API tokens. These tokens allow you or your agents to run terminal commands via shumai-cli." |
*
* @param {Api_Tokens_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_tokens_description: ((inputs?: Api_Tokens_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Api_Tokens_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Api_Tokens_DescriptionInputs = {};
