/**
* | output |
* | --- |
* | "Applies to members with the specified role" |
*
* @param {Quota_Scope_Role_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_role_description: ((inputs?: Quota_Scope_Role_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Scope_Role_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Scope_Role_DescriptionInputs = {};
