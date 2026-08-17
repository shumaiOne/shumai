/**
* | output |
* | --- |
* | "Configure resource limits, target scopes, and evaluation periods." |
*
* @param {Edit_Quota_Rule_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_quota_rule_description: ((inputs?: Edit_Quota_Rule_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Edit_Quota_Rule_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Edit_Quota_Rule_DescriptionInputs = {};
