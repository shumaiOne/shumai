/**
* | output |
* | --- |
* | "New Chat" |
*
* @param {New_ChatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_chat: ((inputs?: New_ChatInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<New_ChatInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type New_ChatInputs = {};
