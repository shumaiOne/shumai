/**
* | output |
* | --- |
* | "Owner & Editor" |
*
* @param {Permission_Owner_And_EditorInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const permission_owner_and_editor: ((inputs?: Permission_Owner_And_EditorInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Permission_Owner_And_EditorInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Permission_Owner_And_EditorInputs = {};
