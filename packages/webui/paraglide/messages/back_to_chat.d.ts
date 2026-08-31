/**
* | output |
* | --- |
* | "Back to Chat" |
*
* @param {Back_To_ChatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const back_to_chat: ((inputs?: Back_To_ChatInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Back_To_ChatInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Back_To_ChatInputs = {};
