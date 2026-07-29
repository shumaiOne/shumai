/**
* | output |
* | --- |
* | "Naming" |
*
* @param {Session_Type_NamingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_type_naming: ((inputs?: Session_Type_NamingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Session_Type_NamingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Session_Type_NamingInputs = {};
