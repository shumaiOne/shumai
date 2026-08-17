/**
* | output |
* | --- |
* | "Set up a new resource quota to prevent unexpected usage." |
*
* @param {Create_Quota_Rule_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_quota_rule_description: ((inputs?: Create_Quota_Rule_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Create_Quota_Rule_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Create_Quota_Rule_DescriptionInputs = {};
