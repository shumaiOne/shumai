/**
* | output |
* | --- |
* | "Owner Only" |
*
* @param {Permission_Owner_OnlyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const permission_owner_only: ((inputs?: Permission_Owner_OnlyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Permission_Owner_OnlyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Permission_Owner_OnlyInputs = {};
