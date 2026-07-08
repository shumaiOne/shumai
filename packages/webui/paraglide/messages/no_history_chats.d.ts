/**
* | output |
* | --- |
* | "No chat history yet." |
*
* @param {No_History_ChatsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_history_chats: ((inputs?: No_History_ChatsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_History_ChatsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_History_ChatsInputs = {};
