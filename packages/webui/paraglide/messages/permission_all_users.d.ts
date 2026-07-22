/**
* | output |
* | --- |
* | "All Users" |
*
* @param {Permission_All_UsersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const permission_all_users: ((inputs?: Permission_All_UsersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Permission_All_UsersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Permission_All_UsersInputs = {};
