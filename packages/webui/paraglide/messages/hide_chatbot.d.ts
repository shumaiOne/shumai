/**
* | output |
* | --- |
* | "Hide Chatbot" |
*
* @param {Hide_ChatbotInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hide_chatbot: ((inputs?: Hide_ChatbotInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hide_ChatbotInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hide_ChatbotInputs = {};
