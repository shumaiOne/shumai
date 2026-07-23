/**
* | output |
* | --- |
* | "Monitor AI token consumption and estimated costs for your team and members." |
*
* @param {Ai_Usage_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ai_usage_description: ((inputs?: Ai_Usage_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Ai_Usage_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Ai_Usage_DescriptionInputs = {};
