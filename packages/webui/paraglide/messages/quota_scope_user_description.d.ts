/**
* | output |
* | --- |
* | "Applies exclusively to the selected user" |
*
* @param {Quota_Scope_User_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_user_description: ((inputs?: Quota_Scope_User_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Scope_User_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Scope_User_DescriptionInputs = {};
