/**
* | output |
* | --- |
* | "Collapse quota rule" |
*
* @param {Quota_Collapse_RuleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_collapse_rule: ((inputs?: Quota_Collapse_RuleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Collapse_RuleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Collapse_RuleInputs = {};
