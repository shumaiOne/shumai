/**
* | output |
* | --- |
* | "Entire Team" |
*
* @param {Quota_Scope_TeamInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_team: ((inputs?: Quota_Scope_TeamInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Scope_TeamInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Scope_TeamInputs = {};
