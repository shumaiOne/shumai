/**
* | output |
* | --- |
* | "Please select a chat agent in settings first." |
*
* @param {Configure_Chat_Agent_TooltipInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const configure_chat_agent_tooltip: ((inputs?: Configure_Chat_Agent_TooltipInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Configure_Chat_Agent_TooltipInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Configure_Chat_Agent_TooltipInputs = {};
