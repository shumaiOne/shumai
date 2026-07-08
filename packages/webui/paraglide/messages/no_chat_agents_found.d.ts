/**
* | output |
* | --- |
* | "No active chat agents found. Please create/enable one in the Agents tab first." |
*
* @param {No_Chat_Agents_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_chat_agents_found: ((inputs?: No_Chat_Agents_FoundInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Chat_Agents_FoundInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Chat_Agents_FoundInputs = {};
