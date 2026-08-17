/**
* | output |
* | --- |
* | "Create Quota Rule" |
*
* @param {Create_Quota_RuleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_quota_rule: ((inputs?: Create_Quota_RuleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Create_Quota_RuleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Create_Quota_RuleInputs = {};
