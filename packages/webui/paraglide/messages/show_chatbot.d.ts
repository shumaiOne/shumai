/**
* | output |
* | --- |
* | "Show Chatbot" |
*
* @param {Show_ChatbotInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const show_chatbot: ((inputs?: Show_ChatbotInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Show_ChatbotInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Show_ChatbotInputs = {};
