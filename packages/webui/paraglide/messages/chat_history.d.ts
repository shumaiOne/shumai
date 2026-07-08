/**
* | output |
* | --- |
* | "Chat History" |
*
* @param {Chat_HistoryInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chat_history: ((inputs?: Chat_HistoryInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Chat_HistoryInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Chat_HistoryInputs = {};
