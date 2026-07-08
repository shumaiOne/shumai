/**
* | output |
* | --- |
* | "Chatbot agent updated" |
*
* @param {Chatbot_Agent_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_agent_updated: ((inputs?: Chatbot_Agent_UpdatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Chatbot_Agent_UpdatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Chatbot_Agent_UpdatedInputs = {};
