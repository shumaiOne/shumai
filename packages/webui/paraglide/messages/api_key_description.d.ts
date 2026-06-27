/**
* | output |
* | --- |
* | "You can provide a literal value (e.g. sk-...) or an Environment variable name (e.g. MY_API_KEY)." |
*
* @param {Api_Key_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_description: ((inputs?: Api_Key_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Api_Key_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Api_Key_DescriptionInputs = {};
