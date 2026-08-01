/**
* | output |
* | --- |
* | "Select Users" |
*
* @param {Select_UsersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_users: ((inputs?: Select_UsersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_UsersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_UsersInputs = {};
