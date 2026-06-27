/**
* | output |
* | --- |
* | "Describe the agent's personality, tone, and behavior..." |
*
* @param {Agent_Soul_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_soul_placeholder: ((inputs?: Agent_Soul_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Soul_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Soul_PlaceholderInputs = {};
