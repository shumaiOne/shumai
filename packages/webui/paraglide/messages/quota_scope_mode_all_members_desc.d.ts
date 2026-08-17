/**
* | output |
* | --- |
* | "Shared pooled limit across all matching members" |
*
* @param {Quota_Scope_Mode_All_Members_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_mode_all_members_desc: ((inputs?: Quota_Scope_Mode_All_Members_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Scope_Mode_All_Members_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Scope_Mode_All_Members_DescInputs = {};
