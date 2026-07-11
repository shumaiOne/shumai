/**
* | output |
* | --- |
* | "Global Chatbot" |
*
* @param {Global_ChatbotInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const global_chatbot: ((inputs?: Global_ChatbotInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Global_ChatbotInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Global_ChatbotInputs = {};
