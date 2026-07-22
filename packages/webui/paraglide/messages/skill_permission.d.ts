/**
* | output |
* | --- |
* | "Permission" |
*
* @param {Skill_PermissionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const skill_permission: ((inputs?: Skill_PermissionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Skill_PermissionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Skill_PermissionInputs = {};
