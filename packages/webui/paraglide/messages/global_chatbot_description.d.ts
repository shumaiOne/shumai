/**
* | output |
* | --- |
* | "Select the agent that handles conversation inside the global chatbot sidebar." |
*
* @param {Global_Chatbot_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const global_chatbot_description: ((inputs?: Global_Chatbot_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Global_Chatbot_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Global_Chatbot_DescriptionInputs = {};
