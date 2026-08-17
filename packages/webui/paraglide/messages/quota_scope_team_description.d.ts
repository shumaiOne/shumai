/**
* | output |
* | --- |
* | "Applies collectively to the entire team" |
*
* @param {Quota_Scope_Team_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_team_description: ((inputs?: Quota_Scope_Team_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Scope_Team_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Scope_Team_DescriptionInputs = {};
