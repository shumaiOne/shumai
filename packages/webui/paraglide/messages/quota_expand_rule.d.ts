/**
* | output |
* | --- |
* | "Expand quota rule" |
*
* @param {Quota_Expand_RuleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_expand_rule: ((inputs?: Quota_Expand_RuleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Expand_RuleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Expand_RuleInputs = {};
