/**
* | output |
* | --- |
* | "Chat" |
*
* @param {Session_Type_ChatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_type_chat: ((inputs?: Session_Type_ChatInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Session_Type_ChatInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Session_Type_ChatInputs = {};
