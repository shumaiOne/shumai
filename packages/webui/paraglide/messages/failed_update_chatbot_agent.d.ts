/**
* | output |
* | --- |
* | "Failed to update chatbot agent" |
*
* @param {Failed_Update_Chatbot_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_chatbot_agent: ((inputs?: Failed_Update_Chatbot_AgentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Update_Chatbot_AgentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Update_Chatbot_AgentInputs = {};
