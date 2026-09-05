/**
* | output |
* | --- |
* | "Configure API keys for built-in media generation providers. Providers can use environment variables or custom keys." |
*
* @param {Media_Providers_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_providers_description: ((inputs?: Media_Providers_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Media_Providers_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Media_Providers_DescriptionInputs = {};
