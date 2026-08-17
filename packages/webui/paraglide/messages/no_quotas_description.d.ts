/**
* | output |
* | --- |
* | "Set limits on AI tokens, costs, skill executions, and network requests to manage team usage." |
*
* @param {No_Quotas_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_quotas_description: ((inputs?: No_Quotas_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Quotas_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Quotas_DescriptionInputs = {};
