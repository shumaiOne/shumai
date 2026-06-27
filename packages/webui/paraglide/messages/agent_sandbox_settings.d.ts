/**
* | output |
* | --- |
* | "Agent Sandbox Settings" |
*
* @param {Agent_Sandbox_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_sandbox_settings: ((inputs?: Agent_Sandbox_SettingsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Sandbox_SettingsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Sandbox_SettingsInputs = {};
