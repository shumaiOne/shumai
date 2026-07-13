/**
* | output |
* | --- |
* | "Select chatbot agent" |
*
* @param {Select_Chatbot_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_chatbot_agent: ((inputs?: Select_Chatbot_AgentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Chatbot_AgentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Chatbot_AgentInputs = {};
