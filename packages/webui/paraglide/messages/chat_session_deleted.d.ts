/**
* | output |
* | --- |
* | "Chat session deleted" |
*
* @param {Chat_Session_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chat_session_deleted: ((inputs?: Chat_Session_DeletedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Chat_Session_DeletedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Chat_Session_DeletedInputs = {};
