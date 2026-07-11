/**
* | output |
* | --- |
* | "No chat agents found. Please create a Chat Agent below first." |
*
* @param {No_Chat_Agents_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_chat_agents_warning: ((inputs?: No_Chat_Agents_WarningInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Chat_Agents_WarningInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Chat_Agents_WarningInputs = {};
