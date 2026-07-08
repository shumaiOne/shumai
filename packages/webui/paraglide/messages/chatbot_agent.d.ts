/**
* | output |
* | --- |
* | "Default Chat Agent" |
*
* @param {Chatbot_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_agent: ((inputs?: Chatbot_AgentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Chatbot_AgentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Chatbot_AgentInputs = {};
