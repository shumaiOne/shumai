/**
* | output |
* | --- |
* | "Project-scoped member roles are managed within individual project settings" |
*
* @param {Project_Member_Role_TooltipInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_member_role_tooltip: ((inputs?: Project_Member_Role_TooltipInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Project_Member_Role_TooltipInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Project_Member_Role_TooltipInputs = {};
